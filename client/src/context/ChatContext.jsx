import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import ProfileConflictModal from '../components/ui/ProfileConflictModal';
import { useProfile } from './ProfileContext';

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

  const activeStreamRef = useRef(null);
  const roadmapPromptShownRef = useRef(false);

  const showProfileRoadmapPrompt = useCallback(() => {
    if (roadmapPromptShownRef.current) return;
    roadmapPromptShownRef.current = true;
    setMessages((prev) => {
      if (prev.some((m) => m.isRoadmapPrompt)) return prev;
      return [...prev, { role: 'system', isRoadmapPrompt: true, timestamp: new Date() }];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pollQueue = async () => {
      try {
        const res = await api.get('/ai/queue');
        if (!cancelled) {
          setAiQueue(res.data?.data || { busy: false, current_task: null });
        }
      } catch {
        if (!cancelled) setAiQueue({ busy: false, current_task: null });
      }
    };
    pollQueue();
    const intervalId = setInterval(pollQueue, 2000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isThinking, isStreaming, isGeneratingRoadmap]);

  const aiQueueBlocksSend = aiQueue.busy && aiQueue.current_task !== 'chat';

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
      await fetchProfile();
      showAutoAppliedToast(autoApplied);
    }

    if (conflicts.length > 0 || Object.keys(pending).length > 0) {
      setConflictModalOpen(true);
    }

    if (result.profileComplete) {
      showProfileRoadmapPrompt();
    }
  }, [fetchProfile, showAutoAppliedToast, showProfileRoadmapPrompt]);

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
      await fetchProfile();
      setMessages((prev) => [
        ...prev,
        {
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
    roadmapPromptShownRef.current = false;
    return session;
  }, []);

  const loadSession = useCallback(async (sessionId) => {
    const res = await api.get(`/chat/session/${sessionId}`);
    const session = res.data.data.session;
    setActiveSessionId(sessionId);
    setMessages(session.messages || []);
    setIsClosed(session.isClosed || false);
    setPendingExtraction(null);
    roadmapPromptShownRef.current = false;

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
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!activeSessionId || !text.trim()) return;

    if (activeStreamRef.current) {
      activeStreamRef.current.abort();
    }
    const controller = new AbortController();
    activeStreamRef.current = controller;

    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setIsThinking(true);
    setIsStreaming(false);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const streamUrl = `${baseUrl}/chat/session/${activeSessionId}/stream`;

      const response = await fetch(streamUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming failed, switching to fallback.');
      }

      setIsThinking(false);
      setIsStreaming(true);

      setMessages((prev) => [
        ...prev,
        { role: 'model', content: '', timestamp: new Date(), isStreaming: true, sources: [] },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullStreamedText = '';
      let displayedLength = 0;
      let isStreamDone = false;
      let extractionResult = null;

      const typingInterval = setInterval(() => {
        if (displayedLength < fullStreamedText.length) {
          const backlog = fullStreamedText.length - displayedLength;
          let speedFactor = 3;
          if (backlog > 80) speedFactor = 16;
          else if (backlog > 40) speedFactor = 8;
          else if (backlog > 15) speedFactor = 5;

          displayedLength += Math.min(speedFactor, backlog);
          const currentText = fullStreamedText.slice(0, displayedLength);

          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const lastIdx = prev.length - 1;
            if (prev[lastIdx].role !== 'model') return prev;
            return [...prev.slice(0, lastIdx), { ...prev[lastIdx], content: currentText }];
          });
        } else if (isStreamDone && displayedLength >= fullStreamedText.length) {
          clearInterval(typingInterval);
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const lastIdx = prev.length - 1;
            if (prev[lastIdx].role !== 'model') return prev;
            return [...prev.slice(0, lastIdx), { ...prev[lastIdx], isStreaming: false }];
          });
          setIsStreaming(false);
        }
      }, 8);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        buffer += textChunk;
        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const evt of events) {
          const trimmed = evt.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const rawVal = trimmed.replace('data: ', '');
          if (rawVal === '[DONE]') {
            isStreamDone = true;
          } else {
            let tokenText = '';
            try {
              const parsed = JSON.parse(rawVal);
              if (parsed.type === 'error') {
                throw new Error(parsed.message || 'AI service unavailable');
              }
              if (parsed.type === 'pending_extraction') {
                extractionResult = parsed;
                if (parsed.profileComplete) {
                  showProfileRoadmapPrompt();
                }
                continue;
              }
              if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const lastIdx = prev.length - 1;
                  if (prev[lastIdx].role !== 'model') return prev;
                  return [...prev.slice(0, lastIdx), { ...prev[lastIdx], sources: parsed.sources }];
                });
                continue;
              }
              if (parsed.chunk !== undefined) {
                tokenText = String(parsed.chunk).replace(/\\n/g, '\n');
              }
            } catch (err) {
              if (err.message && err.message !== rawVal) throw err;
              tokenText = rawVal.replace(/\\n/g, '\n');
            }
            if (tokenText) {
              fullStreamedText += tokenText;
            }
          }
        }
      }

      isStreamDone = true;

      await handleExtractionResult(extractionResult);

      try {
        const listRes = await api.get('/chat/sessions');
        setSessions(listRes.data.data.sessions);
      } catch (err) {
        console.error('Failed to refresh sessions:', err);
      }

      try {
        const sessionRes = await api.get(`/chat/session/${activeSessionId}`);
        const updatedSession = sessionRes.data?.data?.session;
        if (updatedSession) {
          setIsClosed(updatedSession.isClosed || false);
          if (updatedSession.generatedRoadmap) {
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
        }
      } catch (err) {
        console.error('Failed to fetch latest session:', err);
      }

      await fetchProfileScore();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[ChatContext] Streaming unavailable, trying standard endpoint:', err.message);
      setStreamFallbackToast({ id: Date.now() });
      setTimeout(() => setStreamFallbackToast(null), 4000);
      try {
        const res = await api.post(`/chat/session/${activeSessionId}/message`, { text });
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

        setMessages((prev) => [...prev, { role: 'model', content: '', timestamp: new Date(), isStreaming: true }]);
        setIsClosed(updatedSession?.isClosed || false);

        let displayedLength = 0;
        const typingInterval = setInterval(() => {
          if (displayedLength < reply.length) {
            displayedLength += Math.min(3, reply.length - displayedLength);
            const currentText = reply.slice(0, displayedLength);
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const lastIdx = prev.length - 1;
              if (prev[lastIdx].role !== 'model') return prev;
              return [...prev.slice(0, lastIdx), { ...prev[lastIdx], content: currentText }];
            });
          } else {
            clearInterval(typingInterval);
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const lastIdx = prev.length - 1;
              if (prev[lastIdx].role !== 'model') return prev;
              return [...prev.slice(0, lastIdx), { ...prev[lastIdx], isStreaming: false }];
            });
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
      } catch (fallbackErr) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            content: fallbackErr.response?.data?.message || "I'm having trouble connecting right now. Please try again.",
            timestamp: new Date(),
            isError: true,
          },
        ]);
      } finally {
        setIsThinking(false);
        setIsStreaming(false);
      }
    } finally {
      activeStreamRef.current = null;
      setIsStreaming(false);
      setIsThinking(false);
    }
  }, [activeSessionId, fetchProfileScore, handleExtractionResult, showProfileRoadmapPrompt]);

  const deleteSession = useCallback(async (sessionId) => {
    try {
      await api.delete(`/chat/session/${sessionId}`);
    } catch (err) {
      console.error('Failed to delete session:', err);
      return;
    }
    setSessions((prev) => prev.filter((s) => s._id !== sessionId));
    if (activeSessionId === sessionId) {
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
    setIsGeneratingRoadmap(true);
    try {
      const res = await api.post(`/chat/session/${sessionId}/generate-roadmap`, {}, {
        timeout: 620000,
      });
      const roadmap = res.data?.data?.roadmap;
      if (!roadmap?.phases?.length) {
        throw new Error('Roadmap generation returned no milestones.');
      }
      setGeneratedRoadmap(roadmap);
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
        prev.map((s) => (s._id === sessionId ? { ...s, generatedRoadmap: roadmap } : s)),
      );
      setMessages((prev) => [
        ...prev,
        {
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
  }, [activeSessionId, sessions]);

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
        aiQueueBlocksSend,
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
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 text-slate-200 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl backdrop-blur-sm border border-white/10 animate-fade-in-up">
          Profile updated: added {profileAutoToast.fields.join(', ')}
        </div>
      )}
      {streamFallbackToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-amber-900/90 text-amber-100 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl backdrop-blur-sm border border-amber-500/30 animate-fade-in-up">
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
