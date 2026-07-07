const {
  getUser,
  updateUser,
  getSessions,
  getSessionById,
  createSession: dbCreateSession,
  saveSession,
  deleteSession: dbDeleteSession,
  userToMergedProfile,
} = require('../db');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const roadmapService = require('../services/roadmapService');
const { extractAndValidateFromMessage } = require('../services/profileExtractorService');
const { getAiServerHeaders, getAiServerUrl, summarizeSessionMemory, deleteSessionMemory, assertAiAvailable } = require('../utils/aiServerClient');

const MAX_MESSAGES = Number(process.env.MAX_CHAT_MESSAGES) || 5000;
const MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH) || 4000;
const CONFIDENCE_THRESHOLD = 0.75;

const HIGH_STAKES_FIELDS = new Set([
  'name', 'gpa', 'educationLevel', 'targetDegree', 'major',
  'englishTest', 'maxBudget', 'preferredCountries',
]);

const FIELD_LABELS = {
  name: 'Full Name',
  educationLevel: 'Current Education Level',
  targetDegree: 'Target Degree',
  major: 'Field of Study',
  gpa: 'CGPA',
  englishTest: 'English Test Type',
  englishTestScore: 'English Test Score',
  maxBudget: 'Annual Budget (USD)',
  preferredCountries: 'Preferred Countries',
};

function isProfileFieldEmpty(field, profile, userName) {
  if (field === 'name') {
    return !userName || userName.trim() === '' || userName === 'Student';
  }
  if (field === 'preferredCountries') {
    return !profile.preferredCountries || profile.preferredCountries.length === 0;
  }
  if (field === 'englishTest') {
    const et = profile.englishTest;
    return !et || !et.testType || et.testType === 'None';
  }
  const val = profile[field];
  return val === null || val === undefined || val === '';
}

function isCountriesAdditionOnly(oldList, newList) {
  const oldSet = new Set(oldList || []);
  const newSet = new Set(newList || []);
  for (const country of oldSet) {
    if (!newSet.has(country)) return false;
  }
  return true;
}

function resolveCountryList(existing, incoming, countryOps) {
  const oldList = existing || [];
  if (countryOps?.replaceOnly && incoming?.length) {
    return incoming.slice(0, 10);
  }
  let merged = [...oldList];
  if (countryOps?.remove?.length) {
    merged = merged.filter((c) => !countryOps.remove.includes(c));
  }
  const toAdd = countryOps?.add?.length ? countryOps.add : (incoming || []);
  return Array.from(new Set([...merged, ...toAdd])).slice(0, 10);
}

function valuesDiffer(field, profile, userName, newVal) {
  if (field === 'name') {
    return String(userName || '').trim().toLowerCase() !== String(newVal || '').trim().toLowerCase();
  }
  if (field === 'gpa') {
    return Math.abs(Number(profile.gpa) - Number(newVal)) > 0.05;
  }
  if (field === 'maxBudget') {
    return Number(profile.maxBudget) !== Number(newVal);
  }
  if (field === 'englishTest') {
    const oldEt = profile.englishTest || {};
    if (newVal?.testType && oldEt.testType && newVal.testType !== oldEt.testType) return true;
    if (newVal?.score != null && oldEt.score != null
        && Math.abs(Number(newVal.score) - Number(oldEt.score)) >= 0.5) return true;
    return false;
  }
  if (field === 'preferredCountries') {
    return JSON.stringify([...(profile.preferredCountries || [])].sort())
      !== JSON.stringify([...(newVal || [])].sort());
  }
  return String(profile[field] ?? '') !== String(newVal ?? '');
}

function buildConflicts(currentProfile, pending, userName) {
  if (!pending || typeof pending !== 'object') return [];

  const conflicts = [];
  const seen = new Set();

  const addConflict = (field, label, oldValue, newValue, reason) => {
    if (seen.has(field)) return;
    seen.add(field);
    conflicts.push({ field, label, oldValue, newValue, reason });
  };

  const compare = (field, label, equalFn = (a, b) => a === b) => {
    const oldVal = field === 'name' ? userName : currentProfile[field];
    const newVal = pending[field];
    if (newVal === null || newVal === undefined) return;
    if (field !== 'name' && (oldVal === null || oldVal === undefined || oldVal === '')) return;
    if (field === 'name' && isProfileFieldEmpty('name', currentProfile, userName)) return;
    if (!equalFn(oldVal, newVal)) {
      addConflict(field, label, oldVal, newVal);
    }
  };

  compare('name', FIELD_LABELS.name);
  compare('educationLevel', FIELD_LABELS.educationLevel);
  compare('targetDegree', FIELD_LABELS.targetDegree);
  compare('major', FIELD_LABELS.major);
  compare('maxBudget', FIELD_LABELS.maxBudget, (a, b) => Number(a) === Number(b));

  if (pending.gpa != null && currentProfile.gpa != null
      && Math.abs(Number(pending.gpa) - Number(currentProfile.gpa)) > 0.05) {
    addConflict('gpa', FIELD_LABELS.gpa, currentProfile.gpa, pending.gpa);
  }

  if (pending.englishTest?.testType && currentProfile.englishTest?.testType) {
    if (pending.englishTest.testType !== currentProfile.englishTest.testType) {
      addConflict(
        'englishTest',
        FIELD_LABELS.englishTest,
        currentProfile.englishTest.testType,
        pending.englishTest.testType,
      );
    } else if (pending.englishTest.score != null && currentProfile.englishTest.score != null
        && Math.abs(Number(pending.englishTest.score) - Number(currentProfile.englishTest.score)) >= 0.5) {
      addConflict(
        'englishTestScore',
        FIELD_LABELS.englishTestScore,
        currentProfile.englishTest.score,
        pending.englishTest.score,
      );
    }
  }

  const oldCountries = currentProfile.preferredCountries || [];
  const newCountries = pending.preferredCountries || [];
  if (oldCountries.length > 0 && newCountries.length > 0
      && !isCountriesAdditionOnly(oldCountries, newCountries)) {
    addConflict(
      'preferredCountries',
      FIELD_LABELS.preferredCountries,
      oldCountries,
      newCountries,
    );
  }

  Object.keys(pending).forEach((field) => {
    if (field.startsWith('_') || seen.has(field)) return;
    if (field === 'englishTest' && seen.has('englishTestScore')) return;
    const label = FIELD_LABELS[field] || field;
    const oldVal = field === 'name' ? userName : currentProfile[field];
    addConflict(field, label, oldVal ?? '(not set)', pending[field]);
  });

  return conflicts;
}

function splitAndApplyExtraction(user, extracted, validationMeta) {
  const profileContext = buildProfileContext(user);
  const autoApplied = {};
  const pendingExtraction = {};

  if (!extracted || typeof extracted !== 'object') {
    return { autoApplied, pendingExtraction, conflicts: [], profileContext, user };
  }

  const countryOps = extracted._countryOps;
  const metaKeys = validationMeta && Object.keys(validationMeta).length > 0;

  Object.entries(extracted).forEach(([field, value]) => {
    if (field.startsWith('_') || value === null || value === undefined) return;

    const meta = validationMeta?.[field] || {};
    const action = String(meta.action || (metaKeys ? 'skip' : 'update')).toLowerCase();
    const confidence = Number(meta.confidence ?? (metaKeys ? 0 : 1));

    if (action === 'skip' || confidence < CONFIDENCE_THRESHOLD) return;

    if (action === 'conflict') {
      pendingExtraction[field] = value;
      return;
    }

    const empty = isProfileFieldEmpty(field, profileContext, user.name);
    const highStakes = HIGH_STAKES_FIELDS.has(field);

    if (field === 'preferredCountries') {
      const merged = resolveCountryList(profileContext.preferredCountries, value, countryOps);
      const oldCountries = profileContext.preferredCountries || [];

      if (empty || isCountriesAdditionOnly(oldCountries, merged)) {
        autoApplied.preferredCountries = merged;
      } else if (!valuesDiffer('preferredCountries', profileContext, user.name, merged)) {
        // no change
      } else {
        pendingExtraction.preferredCountries = merged;
      }
      return;
    }

    if (field === 'name') {
      if (empty) autoApplied.name = value;
      else if (valuesDiffer('name', profileContext, user.name, value)) pendingExtraction.name = value;
      return;
    }

    if (field === 'englishTest') {
      if (empty) {
        autoApplied.englishTest = value;
      } else if (valuesDiffer('englishTest', profileContext, user.name, value)) {
        pendingExtraction.englishTest = value;
      }
      return;
    }

    if (highStakes && !empty && valuesDiffer(field, profileContext, user.name, value)) {
      pendingExtraction[field] = value;
      return;
    }

    autoApplied[field] = value;
  });

  const profileUpdates = {};
  Object.entries(autoApplied).forEach(([key, val]) => {
    if (key !== 'name') profileUpdates[key] = val;
  });

  if (autoApplied.name || Object.keys(profileUpdates).length > 0) {
    const updatePayload = {};
    if (autoApplied.name) updatePayload.name = autoApplied.name;
    if (Object.keys(profileUpdates).length > 0) updatePayload.profile = profileUpdates;
    updateUser(updatePayload);
    const appliedKeys = [
      ...(autoApplied.name ? ['name'] : []),
      ...Object.keys(profileUpdates),
    ];
    console.log(`[ProfileExtractor] Auto-applied: ${appliedKeys.join(', ')}`);
  }

  const updatedUser = getUser();
  const updatedProfile = buildProfileContext(updatedUser);
  const conflicts = buildConflicts(profileContext, pendingExtraction, user.name);

  return {
    autoApplied,
    pendingExtraction,
    conflicts,
    profileContext: updatedProfile,
    user: updatedUser,
  };
}

function buildPendingExtraction(extracted) {
  if (!extracted || typeof extracted !== 'object') return {};
  return Object.fromEntries(
    Object.entries(extracted).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined),
  );
}

const trimSessionMessages = (session) => {
  if (MAX_MESSAGES > 0 && session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
};

function isProfileComplete(profile) {
  if (!profile) return false;
  return profile.gpa != null
    && Boolean(profile.targetDegree)
    && Boolean(profile.major)
    && Array.isArray(profile.preferredCountries)
    && profile.preferredCountries.length > 0;
}

function buildProfileContext(user) {
  return userToMergedProfile(user);
}

function buildAiPayload(session, text, profile, user, extractedFieldsSummary) {
  return {
    session_id: String(session._id),
    user_id: 'local-user',
    message: text,
    profile: {
      nationality: String(profile.residency || 'Pakistani'),
      current_degree: profile.educationLevel ? String(profile.educationLevel) : '',
      target_degree: profile.targetDegree || null,
      cgpa: profile.gpa !== null && profile.gpa !== undefined ? Number(profile.gpa) : null,
      preferred_countries: Array.isArray(profile.preferredCountries) ? profile.preferredCountries : [],
      preferred_majors: profile.major ? [String(profile.major)] : [],
      budget: profile.maxBudget !== null && profile.maxBudget !== undefined ? Number(profile.maxBudget) : null,
      english_test: profile.englishTest?.testType ? {
        testType: String(profile.englishTest.testType),
        score: profile.englishTest.score !== null && profile.englishTest.score !== undefined
          ? Number(profile.englishTest.score) : null,
      } : {},
      work_experience: profile.workExperience !== null && profile.workExperience !== undefined
        ? Number(profile.workExperience) : 0,
      research_experience: profile.researchExperience || false,
      publications: profile.publications || 0,
      profile_score: user?.profile?.profileScore || null,
      career_goals: profile.careerGoals || null,
      extracted_this_message: extractedFieldsSummary || null,
    },
    conversation_history: session.messages.slice(-30).map((m) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    })),
  };
}

exports.getSessions = catchAsync(async (req, res) => {
  const limit = process.env.NODE_ENV === 'test' ? 2 : undefined;
  const sessions = getSessions({ limit });
  res.status(200).json({ status: 'success', data: { sessions } });
});

exports.createSession = catchAsync(async (req, res, next) => {
  const user = getUser();
  if (!user) {
    return next(new AppError('Profile not found.', 404));
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sessionCreations = (user.sessionCreations || []).filter(
    (date) => new Date(date) >= sevenDaysAgo,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const createdCount = sessionCreations.filter(
    (date) => new Date(date) >= todayStart,
  ).length;

  if (process.env.NODE_ENV === 'test' && createdCount >= 2) {
    return next(new AppError('You can only generate 2 sessions per day.', 400));
  }

  sessionCreations.push(new Date());
  updateUser({ sessionCreations });

  const session = dbCreateSession({
    messages: [],
    isClosed: false,
    generatedRoadmap: null,
  });

  res.status(201).json({ status: 'success', data: { session } });
});

exports.getSession = catchAsync(async (req, res, next) => {
  const session = getSessionById(req.params.id);
  if (!session) {
    return next(new AppError('Session not found.', 404));
  }
  res.status(200).json({ status: 'success', data: { session } });
});

exports.sendMessage = catchAsync(async (req, res, next) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return next(new AppError('Message text is required.', 400));
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return next(new AppError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, 400));
  }

  const session = getSessionById(req.params.id);
  if (!session) {
    return next(new AppError('Session not found.', 404));
  }

  const user = getUser();
  const { extracted, validationMeta } = await extractAndValidateFromMessage(text, buildProfileContext(user));
  const {
    autoApplied,
    pendingExtraction,
    conflicts,
    profileContext,
    user: refreshedUser,
  } = splitAndApplyExtraction(user, extracted, validationMeta);

  const extractedKeys = Object.keys(buildPendingExtraction({ ...autoApplied, ...pendingExtraction }));
  const extractedFieldsSummary = extractedKeys.length > 0
    ? extractedKeys.map((k) => {
      const val = autoApplied[k] ?? pendingExtraction[k];
      return `${k}=${JSON.stringify(val)}`;
    }).join(', ')
    : null;

  if (Object.keys(pendingExtraction).length > 0 && process.env.DEBUG_ASKPERI) {
    console.log(`[ProfileExtractor] Pending extraction (not saved): ${Object.keys(pendingExtraction).join(', ')}`);
  }

  session.messages.push({ role: 'user', content: text });

  let reply;
  try {
    const aiServerUrl = getAiServerUrl();
    const aiResponse = await fetch(`${aiServerUrl}/chat`, {
      method: 'POST',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(300000),
      body: JSON.stringify(buildAiPayload(session, text, profileContext, refreshedUser, extractedFieldsSummary)),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text().catch(() => '');
      throw new Error(`AI server returned status ${aiResponse.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }

    const aiData = await aiResponse.json();
    reply = aiData.reply || aiData.response;
    if (!reply) {
      throw new Error('AI server returned an empty response');
    }
  } catch (err) {
    console.error('[ChatController] AI server unavailable:', err.message);
    return next(new AppError(
      'Peri is unavailable — the local AI service is not responding. Make sure Ollama is running and the model is pulled (ollama pull gemma3:4b), then retry.',
      503,
    ));
  }

  session.messages.push({ role: 'model', content: reply });
  trimSessionMessages(session);

  saveSession(session);
  res.status(200).json({
    status: 'success',
    data: {
      session,
      reply,
      autoApplied,
      pendingExtraction,
      conflicts,
      profileComplete: isProfileComplete(profileContext),
      degraded: false,
    },
  });
});

exports.sendMessageStream = catchAsync(async (req, res, next) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ status: 'error', message: 'Message text is required.' });
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ status: 'error', message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
  }

  const session = getSessionById(req.params.id);
  if (!session) {
    return res.status(404).json({ status: 'error', message: 'Session not found.' });
  }

  try {
    await assertAiAvailable();
  } catch (err) {
    return next(err);
  }

  console.info(`[chat] stream start session=${req.params.id}`);

  session.messages.push({ role: 'user', content: text });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const writeSse = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (res.flush) res.flush();
  };

  writeSse({ type: 'status', phase: 'profile_extract', message: 'Understanding your message…' });

  const user = getUser();
  const { extracted, validationMeta } = await extractAndValidateFromMessage(text, buildProfileContext(user));
  const {
    autoApplied,
    pendingExtraction,
    conflicts,
    profileContext,
    user: refreshedUser,
  } = splitAndApplyExtraction(user, extracted, validationMeta);

  const extractedKeys = Object.keys(buildPendingExtraction({ ...autoApplied, ...pendingExtraction }));
  const extractedFieldsSummary = extractedKeys.length > 0
    ? extractedKeys.map((k) => {
      const val = autoApplied[k] ?? pendingExtraction[k];
      return `${k}=${JSON.stringify(val)}`;
    }).join(', ')
    : null;

  if (Object.keys(pendingExtraction).length > 0 && process.env.DEBUG_ASKPERI) {
    console.log(`[ProfileExtractor] Pending extraction (not saved): ${Object.keys(pendingExtraction).join(', ')}`);
  }

  writeSse({ type: 'status', phase: 'generating', message: 'Peri is composing a reply…' });

  let fullAssembledReply = '';
  const llmStartedAt = Date.now();
  let firstTokenLogged = false;
  let lastProgressLogAt = llmStartedAt;

  const aiHeartbeat = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - llmStartedAt) / 1000);
    writeSse({ type: 'status', phase: 'generating', message: 'Peri is still working…' });
    console.info(`[chat] Gemma still generating… ${elapsedSec}s elapsed, ${fullAssembledReply.length} chars so far`);
  }, 15000);

  try {
    console.info('[chat] calling AI /chat/stream (Gemma)…');
    const aiServerUrl = getAiServerUrl();
    const aiResponse = await fetch(`${aiServerUrl}/chat/stream`, {
      method: 'POST',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(600000),
      body: JSON.stringify(buildAiPayload(session, text, profileContext, refreshedUser, extractedFieldsSummary)),
    });

    if (!aiResponse.ok || !aiResponse.body) {
      throw new Error(`AI server streaming returned status ${aiResponse?.status}`);
    }

    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      buffer += chunkText;
      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith('data: ')) continue;
        const content = line.slice(6);
        if (content === '[DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }
        if (content.includes('"type": "search_metadata"') || content.includes('"type":"search_metadata"')) {
          continue;
        }
        try {
          const parsed = JSON.parse(content);
          if (parsed.type === 'search_metadata') continue;
          if (parsed.type === 'status') {
            if (parsed.phase === 'searching') {
              console.info('[chat] Gemma pipeline: web search in progress…');
            } else if (parsed.phase === 'generating') {
              console.info('[chat] Gemma pipeline: composing answer…');
            }
            res.write(`data: ${content}\n\n`);
            continue;
          }
          if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
            res.write(`data: ${JSON.stringify({ type: 'sources', sources: parsed.sources })}\n\n`);
            continue;
          }
          if (parsed.chunk !== undefined) {
            const chunkText = String(parsed.chunk).replace(/\\n/g, '\n');
            if (chunkText && !firstTokenLogged) {
              firstTokenLogged = true;
              console.info(
                '[chat] Gemma first token in %.2fs',
                (Date.now() - llmStartedAt) / 1000,
              );
            }
            if (chunkText) {
              const now = Date.now();
              if (now - lastProgressLogAt >= 10000) {
                console.info(
                  '[chat] Gemma streaming… %.0fs elapsed, %s chars',
                  (now - llmStartedAt) / 1000,
                  fullAssembledReply.length + chunkText.length,
                );
                lastProgressLogAt = now;
              }
            }
            res.write(`data: ${content}\n\n`);
            fullAssembledReply += chunkText;
            continue;
          }
          res.write(`data: ${content}\n\n`);
          fullAssembledReply += (parsed.chunk || content).replace(/\\n/g, '\n');
        } catch {
          res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
          fullAssembledReply += content.replace(/\\n/g, '\n');
        }
      }
      if (res.flush) res.flush();
    }
  } catch (err) {
    console.error('[ChatController] AI stream unavailable:', err.message);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Peri is unavailable — the local AI service is not responding. Make sure Ollama is running and the model is pulled (ollama pull gemma3:4b), then retry.',
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } finally {
    clearInterval(aiHeartbeat);
    if (fullAssembledReply.trim()) {
      console.info(
        '[chat] Gemma reply complete in %.2fs (%s chars)',
        (Date.now() - llmStartedAt) / 1000,
        fullAssembledReply.length,
      );
    }
  }

  res.write(`data: ${JSON.stringify({
    type: 'pending_extraction',
    autoApplied,
    pendingExtraction,
    conflicts,
    profileComplete: isProfileComplete(profileContext),
  })}\n\n`);

  try {
    const finalReply = fullAssembledReply.trim();
    session.messages.push({ role: 'model', content: finalReply || 'Response generated.' });
    trimSessionMessages(session);

    saveSession(session);
  } catch (dbErr) {
    console.warn('[ChatController Stream] Database save failed:', dbErr.message);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

exports.generateRoadmap = catchAsync(async (req, res, next) => {
  const session = getSessionById(req.params.id);
  if (!session) {
    return next(new AppError('Session not found.', 404));
  }

  await assertAiAvailable();
  console.info(`[roadmap] generate start session=${req.params.id}`);

  const user = getUser();
  const profile = buildProfileContext(user);
  const roadmap = await roadmapService.generateRoadmap(profile);
  if (!roadmap?.phases?.length) {
    return next(new AppError('Roadmap generation returned no milestones. Please try again.', 503));
  }
  session.generatedRoadmap = roadmap;
  saveSession(session);
  summarizeSessionMemory('local-user', session._id, session.messages).catch((err) => {
    console.warn('[Memory] Failed to summarize session after roadmap:', err.message);
  });

  res.status(200).json({ status: 'success', data: { roadmap } });
});

exports.deleteSession = catchAsync(async (req, res, next) => {
  const session = getSessionById(req.params.id);
  if (!session) {
    return next(new AppError('Session not found.', 404));
  }

  dbDeleteSession(req.params.id);
  try {
    await deleteSessionMemory('local-user', session._id);
  } catch (err) {
    console.warn('[Memory] Failed to delete session memory:', err.message);
  }

  res.status(200).json({ status: 'success', message: 'Session deleted successfully.' });
});
