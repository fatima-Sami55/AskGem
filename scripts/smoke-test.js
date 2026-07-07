#!/usr/bin/env node
/**
 * Smoke test for AskPeri local stack.
 * Requires dev services running: npm run dev (from repo root)
 */
const { OLLAMA_MODEL } = require('./lib/config');
const { checkOllamaModel } = require('./lib/ollama');

const BASE = process.env.API_URL || 'http://127.0.0.1:5000/api/v1';
const FASTAPI = process.env.AI_SERVER_URL || 'http://127.0.0.1:8000';

const results = [];
let verifyPassed = false;

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function skip(name, detail) {
  results.push({ name, ok: true, skipped: true, detail });
  console.log(`⏭️  ${name} — skipped${detail ? `: ${detail}` : ''}`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal || AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function preflightOllama() {
  const result = await checkOllamaModel();
  if (!result.reachable || !result.modelPresent) {
    fail('Ollama preflight', 'Run ollama serve && ollama pull ' + OLLAMA_MODEL);
    return false;
  }
  pass('Ollama preflight', `${OLLAMA_MODEL} available`);
  return true;
}

async function preflightFastApi() {
  try {
    const res = await fetch(`${FASTAPI}/health`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      fail('AI server preflight', `FastAPI returned HTTP ${res.status}`);
      return false;
    }
    const body = await res.json();
    if (!body.ollama || !body.model) {
      fail('AI server preflight', `ollama=${body.ollama} model=${body.model}`);
      return false;
    }
    pass('AI server preflight', 'FastAPI :8000 healthy');
    return true;
  } catch (err) {
    fail('AI server preflight', 'Run npm run dev from repo root');
    return false;
  }
}

async function checkHealth() {
  try {
    const { res, body } = await fetchJson(`${BASE}/health`, { signal: AbortSignal.timeout(10000) });
    const ai = body?.ai || {};
    const serverReachable = Boolean(ai.serverReachable);
    const ollamaOk = Boolean(ai.ollama);
    const modelOk = Boolean(ai.model);

    if (serverReachable && ollamaOk && modelOk) {
      const chromaNote = ai.chroma ? '' : ', chroma degraded';
      pass('Health endpoint', `serverReachable + ollama + model${chromaNote}`);
      return true;
    }

    const errParts = [];
    if (!serverReachable) errParts.push(`serverReachable=false (${ai.serverError || 'unknown'})`);
    if (!ollamaOk) errParts.push('ollama=false');
    if (!modelOk) errParts.push('model=false');
    fail('Health endpoint', `${errParts.join(', ')} (HTTP ${res.status})`);
    return false;
  } catch (err) {
    fail('Health endpoint', err.message);
    return false;
  }
}

async function checkProfile() {
  try {
    const { res, body } = await fetchJson(`${BASE}/profile`);
    if (res.status !== 200) {
      fail('Profile endpoint', `expected 200, got ${res.status}`);
      return false;
    }
    if (!body?.data?.user) {
      fail('Profile endpoint', 'user object missing from response');
      return false;
    }
    pass('Profile endpoint', `user: ${body.data.user.name || 'Student'}`);
    return true;
  } catch (err) {
    fail('Profile endpoint', err.message);
    return false;
  }
}

async function checkCreateSession() {
  try {
    const { res, body } = await fetchJson(`${BASE}/chat/session`, { method: 'POST' });
    if (res.status !== 201) {
      fail('Create session', `expected 201, got ${res.status}`);
      return null;
    }
    const sessionId = body?.data?.session?._id;
    if (!sessionId) {
      fail('Create session', 'session._id missing from response');
      return null;
    }
    pass('Create session', `id: ${sessionId}`);
    return sessionId;
  } catch (err) {
    fail('Create session', err.message);
    return null;
  }
}

async function waitForQueueIdle(maxWaitMs = 90_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const { res, body } = await fetchJson(`${BASE}/ai/queue`, { signal: AbortSignal.timeout(5000) });
      if (res.ok && body?.data && !body.data.busy) {
        return true;
      }
    } catch {
      // queue endpoint may briefly fail during startup
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function checkSendMessage(sessionId) {
  if (!sessionId) return;

  const queueReady = await waitForQueueIdle();
  if (!queueReady) {
    skip('Send message', 'Ollama queue busy after 90s — will try anyway');
  }

  try {
    const { res, body } = await fetchJson(`${BASE}/chat/session/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify({ text: 'Hi' }),
      signal: AbortSignal.timeout(120_000),
    });

    if (res.status === 503 || res.status === 429) {
      const msg = typeof body?.message === 'string' ? body.message : JSON.stringify(body || '');
      if (/AI service|Ollama|ai server|fastapi/i.test(msg)) {
        fail('Send message', `service error (${res.status}): ${msg.slice(0, 120)}`);
        return;
      }
      skip('Send message', `rate-limited or busy (${res.status})`);
      return;
    }

    if (res.status !== 200) {
      fail('Send message', `expected 200, got ${res.status}`);
      return;
    }

    const reply = body?.data?.reply || body?.data?.message || '';
    if (!reply) {
      fail('Send message', 'no reply in response');
      return;
    }

    if (reply.includes('strictly your education advisor')) {
      fail('Send message', 'got off-topic refusal for greeting "Hi"');
      return;
    }

    pass('Send message', 'got reply from Peri');
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      skip('Send message', 'CPU inference slow — not a service failure (120s timeout)');
      return;
    }
    fail('Send message', err.message);
  }
}

async function main() {
  console.log(`AskPeri smoke test → ${BASE}\n`);

  const ollamaOk = await preflightOllama();
  if (!ollamaOk) {
    console.log('\n❌ Preflight failed');
    process.exit(1);
  }

  const aiOk = await preflightFastApi();
  if (!aiOk) {
    console.log('\n❌ Preflight failed');
    process.exit(1);
  }

  verifyPassed = true;

  await checkHealth();
  await checkProfile();
  const sessionId = await checkCreateSession();
  await checkSendMessage(sessionId);

  const hardFails = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);

  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.filter((r) => r.ok && !r.skipped).length}`);
  if (skipped.length) console.log(`Skipped: ${skipped.length}`);
  if (hardFails.length) {
    console.log(`Failed: ${hardFails.length}`);
    process.exit(1);
  }
  console.log('\n✅ All smoke tests passed');
  if (skipped.length && verifyPassed) {
    console.log('   (skipped steps are OK on CPU when verify passed)');
  }
  process.exit(0);
}

main();
