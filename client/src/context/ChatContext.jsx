import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import ProfileConflictModal from '../components/ui/ProfileConflictModal';
import { useProfile } from './ProfileContext';
import { newMessageId } from '../utils/messageIds';
import { parseSseBuffer, parseSsePayload } from '../utils/sseParser';
import {
  savePendingChatMessage,
  clearPendingChatMessage,
  restorePendingChatMessages,
  shouldClearPendingChatMessage,
  getPendingChatMessage,
} from '../utils/askperiStorage';

const ChatContext = createContext(null);

const AUTO_FIELD_LABELS = {
  name: 'name',
  gpa: 'CGPA',
  educationLevel: 'education level',
  targetDegree: 'target degree',
  major: 'field of study',
  maxBudget: 'budget',
  preferredCountries: 'preferred countries',
  englishTest: 'English test',
  workExperience: 'work experience',
  researchExperience: 'research experience',
  publications: 'publications',
  age: 'age',
};

const CONFLICT_FIELD_LABELS = {
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

function buildModalConflicts(conflicts, pending, profile, userName) {
  const items = [...(conflicts || [])];
  const seen = new Set(items.map((c) => c.field));

  Object.entries(pending || {}).forEach(([field, newValue]) => {
    if (seen.has(field)) return;
    items.push({
      field,
      label: CONFLICT_FIELD_LABELS[field] || field,
      oldValue: field === 'name' ? (userName || '(not set)') : (profile?.[field] ?? '(not set)'),
      newValue,
    });
    seen.add(field);
  });

  return items;
}

function messagesMatch(a, b) {
  return a.role === b.role && String(a.content || '') === String(b.content || '');
}

/** Keep local user/in-flight bubbles when server sync lags behind optimistic UI. */
function mergeSessionMessagesWithOptimistic(prev, incoming) {
  const normalized = incoming.map((m, idx) => {
    const byIndex = prev[idx];
    if (byIndex && messagesMatch(byIndex, m)) {
      return {
        ...m,
        id: byIndex.id,
        isStreaming: byIndex.isStreaming,
        sources: byIndex.sources ?? m.sources,
      };
    }
    const byContent = prev.find((p) => messagesMatch(p, m));
    if (byContent?.id) {
      return {
        ...m,
        id: byContent.id,
        isStreaming: byContent.isStreaming,
        sources: byContent.sources ?? m.sources,
      };
    }
    return m;
  });

  const optimisticTail = prev.filter((local) => {
    if (normalized.some((inc) => messagesMatch(inc, local))) return false;
    if (local.role === 'user') return true;
    if (local.isStreaming || local.isError) return true;
    return local.role === 'model' && !String(local.content || '').trim();
  });

  if (optimisticTail.length === 0) return normalized;
  return [...normalized, ...optimisticTail];
}

export function ChatProvider({ children }) {
  const { user, updateProfile, fetchProfile } = useProfile();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [recommendations, setRecommendations] = useState({ programs: [], scholarships: [] });
  const [generatedRoadmap, setGeneratedRoadmap] = useState(null);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [profileScoreData, setProfileScoreData] = useState(null);
  const [lastScoreUpdated, setLastScoreUpdated] = useState(null);
  const [scoreToast, setScoreToast] = useState(null);
  const [pendingExtraction, setPendingExtraction] = useState(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [profileAutoToast, setProfileAutoToast] = useState(null);
  const [streamFallbackToast, setStreamFallbackToast] = useState(null);
  const [aiQueue, setAiQueue] = useState({ busy: false, current_task: null });
  const [pipelineStatus, setPipelineStatus] = useState(null);

  const activeStreamRef = useRef(null);
  const refreshAiQueueRef = useRef(null);
  const awaitingReplyRef = useRef(false);

  const refreshAiQueue = useCallback(async () => {
    try {
      const res = await api.get('/ai/queue');
      const next = res.data?.data || { busy: false, current_task: null };
      setAiQueue(next);
      return next;
    } catch {
      setAiQueue({ busy: false, current_task: null });
      return { busy: false, current_task: null };
    }
  }, []);

  refreshAiQueueRef.current = refreshAiQueue;

  const normalizeSessionMessages = useCallback((rawMessages) => (
    (rawMessages || [])
      .filter((m) => !m.isRoadmapPrompt)
      .map((m) => (m.id ? m : { ...m, id: newMessageId() }))
  ), []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    const POLL_FAST_MS = 2000;
    const POLL_SLOW_MS = 30000;

    const pollQueue = async () => {
      if (cancelled) return { busy: false, current_task: null };
      if (refreshAiQueueRef.current) {
        return refreshAiQueueRef.current();
      }
      return { busy: false, current_task: null };
    };

    const loop = async () => {
      const status = await pollQueue();
      if (cancelled) return;
      const fastPoll = status?.busy || isThinking || isStreaming || isGeneratingRoadmap;
      timeoutId = setTimeout(loop, fastPoll ? POLL_FAST_MS : POLL_SLOW_MS);
    };

    loop();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isThinking, isStreaming, isGeneratingRoadmap]);

  const aiQueueBusy = aiQueue.busy;
  const aiQueueBlocksSend = aiQueueBusy;

  const showAutoAppliedToast = useCallback((autoApplied) => {
    const keys = Object.keys(autoApplied || {});
    if (keys.length === 0) return;
    const labels = keys.map((k) => AUTO_FIELD_LABELS[k] || k);
    setProfileAutoToast({ fields: labels, id: Date.now() });
    setTimeout(() => setProfileAutoToast(null), 3500);
  }, []);

  const handleExtractionResult = useCallback(async (result) => {
    if (!result) return;

    const pending = result.pendingExtraction || {};
    const conflicts = result.conflicts || [];
    const autoApplied = result.autoApplied || {};

    setPendingExtraction({ pendingExtraction: pending, conflicts });

    if (Object.keys(autoApplied).length > 0) {
      await fetchProfile({ silent: true });
      showAutoAppliedToast(autoApplied);
    }

    if (conflicts.length > 0 || Object.keys(pending).length > 0) {
      setConflictModalOpen(true);
    }
  }, [fetchProfile, showAutoAppliedToast]);

  const handleConflictResolve = useCallback(async (choices) => {
    const pending = pendingExtraction?.pendingExtraction || {};
    const conflicts = pendingExtraction?.conflicts || [];
    const profile = user?.profile || {};

    const body = {};
    const fieldsToProcess = new Set([
      ...Object.keys(pending),
      ...conflicts.map((c) => c.field),
    ]);

    fieldsToProcess.forEach((field) => {
      if (choices[field] !== 'update') return;

      if (field === 'name') {
        body.name = pending.name ?? conflicts.find((c) => c.field === 'name')?.newValue;
        return;
      }

      if (field === 'englishTestScore') {
        const conflict = conflicts.find((c) => c.field === 'englishTestScore');
        body.englishTest = {
          ...(profile.englishTest || { testType: 'None', score: null }),
          score: conflict?.newValue ?? pending.englishTest?.score,
        };
        return;
      }

      if (field === 'englishTest') {
        body.englishTest = pending.englishTest ?? conflicts.find((c) => c.field === 'englishTest')?.newValue;
        return;
      }

      body[field] = pending[field] ?? conflicts.find((c) => c.field === field)?.newValue;
    });

    const hasUpdates = Object.keys(body).length > 0;
    if (hasUpdates) {
      await updateProfile(body);
      await fetchProfile({ silent: true });
      setMessages((prev) => [
        ...prev,
        {
          id: newMessageId(),
          role: 'system',
          content: 'Profile updated. Ask Peri again if you want advice based on your new details.',
          timestamp: new Date(),
        },
      ]);
    }

    setPendingExtraction(null);
    setConflictModalOpen(false);
  }, [pendingExtraction, updateProfile, fetchProfile, user]);

  const handleConflictClose = useCallback(() => {
    setConflictModalOpen(false);
    setPendingExtraction(null);
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/chat/sessions');
      setSessions(res.data.data.sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (generatedRoadmap?.phases?.length || sessions.length === 0) return;
    const withRoadmap = sessions.find((s) => s.generatedRoadmap?.phases?.length);
    if (!withRoadmap?.generatedRoadmap) return;
    setGeneratedRoadmap(withRoadmap.generatedRoadmap);
  }, [sessions, generatedRoadmap]);

  const fetchProfileScore = useCallback(async () => {
    try {
      const res = await api.get('/profile/score');
      if (res.data?.data) {
        const newData = res.data.data;
        setProfileScoreData((prev) => {
          if (prev && prev.score !== undefined && newData.score !== undefined && newData.score !== prev.score) {
            setScoreToast({ oldScore: prev.score, newScore: newData.score, id: Date.now() });
            setTimeout(() => setScoreToast(null), 3000);
          }
          return newData;
        });
        setLastScoreUpdated(Date.now());
      }
    } catch (err) {
      console.error('Failed to fetch profile score in ChatContext:', err);
    }
  }, []);

  const createSession = useCallback(async () => {
    const res = await api.post('/chat/session');
    const session = res.data.data.session;
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session._id);
    setMessages([]);
    setRecommendations({ programs: [], scholarships: [] });
    setGeneratedRoadmap(null);
    setIsClosed(false);
    setPendingExtraction(null);
    return session;
  }, []);

  const loadSession = useCallback(async (sessionId) => {
    const res = await api.get(`/chat/session/${sessionId}`);
    const session = res.data.data.session;
    setActiveSessionId(sessionId);

    const serverMessages = normalizeSessionMessages(session.messages);
    const { messages: restoredMessages, awaitingReply } = restorePendingChatMessages(
      sessionId,
      serverMessages,
      newMessageId,
    );
    setMessages(restoredMessages);
    awaitingReplyRef.current = awaitingReply;
    setIsThinking(awaitingReply);
    setIsStreaming(false);
    setIsClosed(session.isClosed || false);
    setPendingExtraction(null);

    if (session.generatedRoadmap?.phases?.length) {
      setGeneratedRoadmap(session.generatedRoadmap);
      const opps = session.generatedRoadmap.opportunities || [];
      setRecommendations({
        programs: opps.filter((o) => o.type === 'program' || o.type === 'university_program'),
        scholarships: opps.filter((o) => o.type === 'scholarship'),
        roadmap: {
          title: session.generatedRoadmap.title || 'Your Custom Roadmap',
          phases: session.generatedRoadmap.phases || [],
        },
      });
    } else if (session.generatedRoadmap) {
      setGeneratedRoadmap(session.generatedRoadmap);
      setRecommendations({
        programs: [],
        scholarships: [],
        roadmap: {
          title: session.generatedRoadmap.title || 'Your Custom Roadmap',
          phases: session.generatedRoadmap.phases || [],
        },
      });
    } else {
      setGeneratedRoadmap(null);
      setRecommendations({ programs: [], scholarships: [], roadmap: null });
    }
  }, [normalizeSessionMessages]);

  const syncMessagesFromServer = useCallback(async (sessionId, { allowDuringReply = false } = {}) => {
    if (!sessionId) return null;
    try {
      const sessionRes = await api.get(`/chat/session/${sessionId}`);
      const updatedSession = sessionRes.data?.data?.session;
      if (updatedSession?.messages?.length) {
        const incoming = normalizeSessionMessages(updatedSession.messages);
        if (!allowDuringReply && awaitingReplyRef.current) {
          // In-flight stream: DB may not have the latest user/model messages yet.
        } else {
          setMessages((prev) =>
            mergeSessionMessagesWithOptimistic(prev, incoming),
          );
          if (shouldClearPendingChatMessage(sessionId, incoming)) {
            clearPendingChatMessage(sessionId);
            awaitingReplyRef.current = false;
            setIsThinking(false);
          }
        }
      }
      if (updatedSession) {
        setIsClosed(updatedSession.isClosed || false);
      }
      return updatedSession;
    } catch (err) {
      console.error('Failed to sync session messages:', err);
      return null;
    }
  }, [normalizeSessionMessages]);

  // If SSE parsing misses the reply, poll saved session messages while Peri is working.
  useEffect(() => {
    if ((!isThinking && !isStreaming && !awaitingReplyRef.current) || !activeSessionId) return undefined;

    const intervalId = setInterval(async () => {
      if (!activeSessionId) return;
      try {
        const sessionRes = await api.get(`/chat/session/${activeSessionId}`);
        const saved = sessionRes.data?.data?.session?.messages || [];
        const pending = getPendingChatMessage(activeSessionId);

        let lastUserIdx = saved.reduce(
          (acc, m, idx) => (m.role === 'user' ? idx : acc),
          -1,
        );

        if (pending?.text) {
          const pendingIdx = saved.findIndex(
            (m) => m.role === 'user' && String(m.content) === pending.text,
          );
          if (pendingIdx < 0) return;
          lastUserIdx = pendingIdx;
        }

        const hasReplyAfterLatestUser = saved
          .slice(lastUserIdx + 1)
          .some((m) => m.role === 'model' && String(m.content || '').trim());
        if (hasReplyAfterLatestUser) {
          awaitingReplyRef.current = false;
          clearPendingChatMessage(activeSessionId);
          setPipelineStatus(null);
          setIsThinking(false);
          setIsStreaming(false);
          await syncMessagesFromServer(activeSessionId, { allowDuringReply: true });
        }
      } catch (err) {
        console.error('Failed to poll session for reply:', err);
      }
    }, 8000);

    return () => clearInterval(intervalId);
  }, [isThinking, isStreaming, activeSessionId, syncMessagesFromServer]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    if (aiQueue.busy) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const res = await api.post('/chat/session');
        const session = res.data.data.session;
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session._id);
        sessionId = session._id;
      } catch (err) {
        console.error('Failed to create chat session:', err);
        return;
      }
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.abort();
    }
    const controller = new AbortController();
    activeStreamRef.current = controller;

    const modelMessageId = newMessageId();
    setMessages((prev) => [
      ...prev,
      { id: newMessageId(), role: 'user', content: text, timestamp: new Date() },
    ]);
    savePendingChatMessage(sessionId, text);
    awaitingReplyRef.current = true;
    setIsThinking(true);
    setIsStreaming(true);

    const upsertModelMessage = (patch) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === modelMessageId);
        if (idx === -1) {
          return [
            ...prev,
            {
              id: modelMessageId,
              role: 'model',
              content: '',
              timestamp: new Date(),
              isStreaming: true,
              sources: [],
              ...patch,
            },
          ];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    };

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const streamUrl = `${baseUrl}/chat/session/${sessionId}/stream`;

      const response = await fetch(streamUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ text }),
      });

      if (response.status === 429) {
        let busyMessage = 'AI is busy. Please wait and try again.';
        try {
          const data = await response.json();
          busyMessage = data.message || busyMessage;
        } catch {
          // ignore parse errors
        }
        upsertModelMessage({
          content: busyMessage,
          isStreaming: false,
          isError: true,
        });
        setIsThinking(false);
        setIsStreaming(false);
        await refreshAiQueue();
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error('Streaming failed, switching to fallback.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      const streamState = { fullStreamedText: '', extractionResult: null, error: null, sources: [] };

      const handleRawEvent = (rawVal) => {
        const payload = parseSsePayload(rawVal);
        if (payload.type === 'done') return;
        if (payload.type === 'error') {
          streamState.error = new Error(payload.message || 'AI service unavailable');
          return;
        }
        if (payload.type === 'pending_extraction') {
          streamState.extractionResult = payload.data;
          return;
        }
        if (payload.type === 'sources') {
          streamState.sources = payload.sources;
          return;
        }
        if (payload.type === 'status') {
          return;
        }
        if (payload.type === 'chunk' && payload.text) {
          streamState.fullStreamedText += payload.text;
          setPipelineStatus(null);
          setIsThinking(false);
          upsertModelMessage({
            content: streamState.fullStreamedText,
            sources: streamState.sources,
            isStreaming: true,
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseBuffer(buffer, handleRawEvent);
      }

      buffer = parseSseBuffer(`${buffer}\n\n`, handleRawEvent);

      if (streamState.error) {
        throw streamState.error;
      }

      if (streamState.fullStreamedText.trim()) {
        upsertModelMessage({
          content: streamState.fullStreamedText,
          sources: streamState.sources,
          isStreaming: false,
        });
      }
      awaitingReplyRef.current = false;
      clearPendingChatMessage(sessionId);
      setPipelineStatus(null);
      setIsStreaming(false);
      setIsThinking(false);

      await handleExtractionResult(streamState.extractionResult);

      try {
        const listRes = await api.get('/chat/sessions');
        setSessions(listRes.data.data.sessions);
      } catch (err) {
        console.error('Failed to refresh sessions:', err);
      }

      await syncMessagesFromServer(sessionId, { allowDuringReply: true });

      try {
        const sessionRes = await api.get(`/chat/session/${sessionId}`);
        const updatedSession = sessionRes.data?.data?.session;
        if (updatedSession?.generatedRoadmap) {
          setGeneratedRoadmap(updatedSession.generatedRoadmap);
          const opps = updatedSession.generatedRoadmap.opportunities || [];
          setRecommendations({
            programs: opps.filter((o) => o.type === 'program' || o.type === 'university_program'),
            scholarships: opps.filter((o) => o.type === 'scholarship'),
            roadmap: {
              title: updatedSession.generatedRoadmap.title || 'Your Custom Roadmap',
              phases: updatedSession.generatedRoadmap.phases || [],
            },
          });
        }
      } catch (err) {
        console.error('Failed to fetch latest session:', err);
      }

      await fetchProfileScore();
      await refreshAiQueue();
    } catch (err) {
      if (err.name === 'AbortError') return;
      setIsStreaming(false);
      setIsThinking(true);
      await syncMessagesFromServer(sessionId, { allowDuringReply: true });
      console.warn('[ChatContext] Streaming unavailable, trying standard endpoint:', err.message);
      setStreamFallbackToast({ id: Date.now() });
      setTimeout(() => setStreamFallbackToast(null), 4000);
      try {
        const queueStatus = await refreshAiQueue();
        if (queueStatus.busy) {
          const busyMessage = queueStatus.current_task
            ? `AI is busy with ${queueStatus.current_task}. Please wait and try again.`
            : 'AI is busy. Please wait and try again.';
          upsertModelMessage({
            content: busyMessage,
            isStreaming: false,
            isError: true,
          });
          return;
        }

        const res = await api.post(`/chat/session/${sessionId}/message`, {
          text,
          skipUserMessage: true,
        });
        const {
          session: updatedSession,
          reply,
          pendingExtraction: pending,
          conflicts,
          autoApplied,
          profileComplete,
        } = res.data.data;

        await handleExtractionResult({
          pendingExtraction: pending,
          conflicts,
          autoApplied,
          profileComplete,
        });

        setIsClosed(updatedSession?.isClosed || false);
        setIsThinking(false);

        let displayedLength = 0;
        const typingInterval = setInterval(() => {
          if (displayedLength < reply.length) {
            displayedLength += Math.min(3, reply.length - displayedLength);
            const currentText = reply.slice(0, displayedLength);
            upsertModelMessage({ content: currentText, isStreaming: true });
          } else {
            clearInterval(typingInterval);
            upsertModelMessage({ content: reply, isStreaming: false });
          }
        }, 12);

        const roadmap = updatedSession?.generatedRoadmap;
        if (roadmap) {
          setGeneratedRoadmap(roadmap);
          if (roadmap.opportunities) {
            const opps = roadmap.opportunities;
            setRecommendations({
              programs: opps.filter((o) => o.type === 'program' || o.type === 'university_program'),
              scholarships: opps.filter((o) => o.type === 'scholarship'),
              roadmap: {
                title: roadmap.title || 'Your Custom Roadmap',
                phases: roadmap.phases || [],
              },
            });
          }
        }

        await fetchProfileScore();
        await refreshAiQueue();
        await syncMessagesFromServer(sessionId, { allowDuringReply: true });
        clearPendingChatMessage(sessionId);
      } catch (fallbackErr) {
        if (fallbackErr.response?.status === 429) {
          upsertModelMessage({
            content: fallbackErr.response?.data?.message || 'AI is busy. Please wait and try again.',
            isStreaming: false,
            isError: true,
          });
        } else {
          upsertModelMessage({
            content: fallbackErr.response?.data?.message || "I'm having trouble connecting right now. Please try again.",
            isStreaming: false,
            isError: true,
          });
        }
        await refreshAiQueue();
      } finally {
        setIsThinking(false);
        setIsStreaming(false);
      }
    } finally {
      activeStreamRef.current = null;
      awaitingReplyRef.current = false;
      setPipelineStatus(null);
      setIsStreaming(false);
      setIsThinking(false);
    }
  }, [activeSessionId, aiQueue.busy, fetchProfileScore, handleExtractionResult, syncMessagesFromServer, refreshAiQueue]);

  const deleteSession = useCallback(async (sessionId) => {
    try {
      await api.delete(`/chat/session/${sessionId}`);
    } catch (err) {
      console.error('Failed to delete session:', err);
      return;
    }
    setSessions((prev) => prev.filter((s) => s._id !== sessionId));
    if (activeSessionId === sessionId) {
      clearPendingChatMessage(sessionId);
      setActiveSessionId(null);
      setMessages([]);
      setRecommendations({ programs: [], scholarships: [] });
      setGeneratedRoadmap(null);
      setIsClosed(false);
      setPendingExtraction(null);
    }
    try {
      const res = await api.get('/chat/sessions');
      setSessions(res.data.data.sessions);
    } catch (err) {
      console.error('Failed to refresh sessions:', err);
    }
  }, [activeSessionId]);

  const generateRoadmap = useCallback(async (sessionIdOverride) => {
    const sessionId = sessionIdOverride || activeSessionId || sessions[0]?._id;
    if (!sessionId) {
      throw new Error('No chat session available for roadmap generation.');
    }
    if (aiQueue.busy) {
      throw new Error('AI is busy. Please wait and try again.');
    }
    setIsGeneratingRoadmap(true);
    try {
      const res = await api.post(`/chat/session/${sessionId}/generate-roadmap`, {}, {
        timeout: 620000,
      });
      const roadmap = res.data?.data?.roadmap;
      const updatedSession = res.data?.data?.session;
      if (!roadmap?.phases?.length) {
        throw new Error('Roadmap generation returned no milestones.');
      }
      setGeneratedRoadmap(roadmap);
      setIsClosed(updatedSession?.isClosed ?? true);
      const opps = roadmap.opportunities || [];
      setRecommendations({
        programs: opps.filter((o) => o.type === 'program' || o.type === 'university_program'),
        scholarships: opps.filter((o) => o.type === 'scholarship'),
        roadmap: {
          title: roadmap.title || 'Your Custom Roadmap',
          phases: roadmap.phases || [],
        },
      });
      setSessions((prev) =>
        prev.map((s) => (
          s._id === sessionId
            ? { ...s, generatedRoadmap: roadmap, isClosed: updatedSession?.isClosed ?? true }
            : s
        )),
      );
      setMessages((prev) => [
        ...prev,
        {
          id: newMessageId(),
          role: 'system',
          content: 'Your roadmap is ready! Open the Roadmap page to review your personalized plan.',
          timestamp: new Date(),
        },
      ]);
      return roadmap;
    } catch (err) {
      console.error('Failed to generate roadmap:', err);
      throw err;
    } finally {
      setIsGeneratingRoadmap(false);
    }
  }, [activeSessionId, sessions, aiQueue.busy]);

  const modalConflicts = buildModalConflicts(
    pendingExtraction?.conflicts,
    pendingExtraction?.pendingExtraction,
    user?.profile,
    user?.name,
  );

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSessionId,
        messages,
        recommendations,
        generatedRoadmap,
        isGeneratingRoadmap,
        isThinking,
        isStreaming,
        isClosed,
        profileScoreData,
        lastScoreUpdated,
        scoreToast,
        profileAutoToast,
        streamFallbackToast,
        aiQueue,
        aiQueueBusy,
        aiQueueBlocksSend,
        pipelineStatus,
        pendingExtraction,
        fetchSessions,
        createSession,
        loadSession,
        sendMessage,
        deleteSession,
        generateRoadmap,
        fetchProfileScore,
      }}
    >
      {children}
      <ProfileConflictModal
        isOpen={conflictModalOpen}
        conflicts={modalConflicts}
        onClose={handleConflictClose}
        onResolve={handleConflictResolve}
      />
      {profileAutoToast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 text-slate-200 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl backdrop-blur-sm border border-white/10 animate-fade-in-up" role="status" aria-live="polite">
          Profile updated: added {profileAutoToast.fields.join(', ')}
        </div>
      )}
      {streamFallbackToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-amber-900/90 text-amber-100 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl backdrop-blur-sm border border-amber-500/30 animate-fade-in-up" role="status" aria-live="polite">
          Connection interrupted — retrying in standard mode.
        </div>
      )}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
