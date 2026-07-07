import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { useProfile } from '../../context/ProfileContext';
import { useMascot } from '../../context/MascotContext';
import InteractiveMascot from '../mascot/InteractiveMascot';
import api from '../../services/api';
import MessageBubble from './MessageBubble';
import { getAiQueueBannerMessage, isChatPipelineBusy } from '../../utils/aiQueue';
import AiBusyBanner from '../features/AiBusyBanner';
import { Send } from 'lucide-react';

export default function ChatWindow() {
  const {
    messages, isThinking, isStreaming, sendMessage, activeSessionId, isClosed,
    scoreToast, aiQueue, aiQueueBlocksSend,
  } = useChat();
  const { user } = useProfile();
  const { triggerMascotAction, resetInactivityTimer } = useMascot();

  const [input, setInput] = useState('');
  const [fullProfile, setFullProfile] = useState(null);
  const [profileBreakdown, setProfileBreakdown] = useState(null);
  const [serverName, setServerName] = useState(null); // fresh name from server (not stale JWT)

  const [isFocused, setIsFocused] = useState(false);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const prevThinkingRef = useRef(false);
  const navigate = useNavigate();

  // Name: server is authoritative (fresh). Auth JWT may be stale after profile update.
  const userName = serverName || user?.name || 'Student';
  const gpa = fullProfile?.gpa !== undefined && fullProfile?.gpa !== null ? fullProfile.gpa : null;
  const admissionChance = profileBreakdown?.admissionChance !== undefined && profileBreakdown?.admissionChance !== null ? profileBreakdown.admissionChance : null;
  const score = profileBreakdown?.score !== undefined && profileBreakdown?.score !== null ? profileBreakdown.score : null;
  const targetCountry = fullProfile?.preferredCountries?.[0] || null;
  const targetDegree = fullProfile?.targetDegree || null;
  const major = fullProfile?.major || null;
  const inputDisabled = isThinking || isStreaming || aiQueueBlocksSend;
  const periIsWorking = isThinking || isStreaming || isChatPipelineBusy(aiQueue);
  const hasStreamingModelBubble = messages.some(
    (m) => m.role === 'model' && m.isStreaming && String(m.content || '').trim(),
  );
  const showThinkingIndicator = periIsWorking && !hasStreamingModelBubble;

  const queueBannerMessage = getAiQueueBannerMessage(aiQueue?.current_task);
  const inputPlaceholder = periIsWorking
    ? 'Peri is thinking — hang tight…'
    : 'Ask Peri anything — universities, scholarships, visas, roadmap...';

  // One-time wave on welcome screen first load
  const hasMountedWave = useRef(false);
  useEffect(() => {
    if (messages.length === 0 && userName && !hasMountedWave.current) {
      hasMountedWave.current = true;
      const t = setTimeout(() => {
        triggerMascotAction({
          type: 'waving',
          mood: 'happy',
          duration: 3000,
          priority: 'MEDIUM',
          speech: `Hi ${userName}! 👋\nReady to plan your journey?`,
        });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [userName, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showThinkingIndicator]);



  useEffect(() => {
    if (periIsWorking && !prevThinkingRef.current) {
      triggerMascotAction({
        type: 'thinking',
        mood: 'curious',
        accessories: ['glasses'],
        duration: 60000,
        priority: 'HIGH',
        speech: 'Hmm, let me look that up for you...',
      });
    } else if (!periIsWorking && prevThinkingRef.current && messages.length >= 2) {
      const last = messages[messages.length - 1];
      const prev = messages[messages.length - 2];
      if (prev.role === 'user' && last.role === 'model' && !last.isStreaming && !last.isError) {
        triggerMascotAction({
          type: 'waving',
          mood: 'happy',
          duration: 2500,
          priority: 'MEDIUM',
          speech: 'Here is what I found!',
        });
      }
    }
    prevThinkingRef.current = periIsWorking;
  }, [periIsWorking, triggerMascotAction, messages]);

  useEffect(() => {
    if (scoreToast) {
      triggerMascotAction({
        type: 'celebrating',
        mood: 'happy',
        accessories: [],
        duration: 4500,
        priority: 'HIGH',
        speech: `Awesome! Your profile score increased: ${scoreToast.oldScore} → ${scoreToast.newScore}! 🎉`,
      });
    }
  }, [scoreToast, triggerMascotAction]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.isError) {
        triggerMascotAction({
          type: 'disappointed',
          mood: 'sad',
          duration: 5000,
          priority: 'HIGH',
          speech: "Oops! I'm having trouble connecting right now. Let's try again!",
        });
      }
    }
  }, [messages, triggerMascotAction]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || inputDisabled) return;
    resetInactivityTimer();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(text);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInput(val);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleCardClick = async (text) => {
    if (inputDisabled) return;
    resetInactivityTimer();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(text);
  };

  const getCounterColor = (count) => {
    if (count > 3600) return '#EF4444';
    if (count > 3000) return '#FBBF24';
    return '#64748B';
  };

  useEffect(() => {
    if (activeSessionId) {
      api.get('/profile')
        .then(res => {
          if (res.data?.data) {
            setFullProfile(res.data.data.user?.profile || {});
            setProfileBreakdown(res.data.data.breakdown || {});
            // Capture fresh name straight from server — not the stale JWT
            if (res.data.data.user?.name) {
              setServerName(res.data.data.user.name);
            }
          }
        })
        .catch(err => console.error('Failed to load profile for welcome screen:', err));
    }
  }, [activeSessionId]);

  // Name: server is authoritative (fresh). Auth JWT may be stale after profile update.

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F172A] relative overflow-hidden">
      {/* Scrollable message thread area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8" style={{ display:'flex', flexDirection:'column' }}>
        {messages.length === 0 && !periIsWorking ? (
          <div className="flex flex-col items-center justify-center min-h-full py-4 px-4 animate-fade-in">


            {/* ── Peri (speech bubble now inside InteractiveMascot) ── */}
            <div className="relative flex items-center justify-center mb-5" style={{ width: 220, height: 220 }}>
              <InteractiveMascot size={220} />
            </div>

            {/* Stats pill */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-xs font-medium text-[#94A3B8] shadow-inner mb-5 flex-wrap justify-center">
              <span className="flex items-center gap-1 text-white">
                🎓 {admissionChance ? `${admissionChance}% Profile Strength` : 'Profile Guidance'}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[#94A3B8]">
                ⭐ Profile Score: <strong className="text-white">{score !== null ? `${score}/100` : 'Not evaluated'}</strong>
              </span>
              {gpa !== null && (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-[#94A3B8]">
                    📊 GPA: <strong className="text-white">{gpa}</strong>
                  </span>
                </>
              )}
              {targetCountry && (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-[#94A3B8]">
                    🎯 Target: <strong className="text-white">{targetCountry}</strong>
                  </span>
                </>
              )}
            </div>

            <p className="text-[10px] text-slate-500 mb-4 text-center max-w-md">
              Heuristic score — not a university-specific admission prediction.
            </p>

            {/* Feature cards — compact 3-col */}
            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-2.5 text-left">
              {[
                { icon: '🎯', title: 'Match Universities', desc: 'Find programs fitted to your GPA and budget' },
                { icon: '💰', title: 'Scholarship Finder', desc: 'Explore funding opportunities worldwide' },
                { icon: '📋', title: 'Step-by-Step Plan', desc: 'Get an actionable timeline for applications' }
              ].map((card, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#6366F1]/40 hover:bg-white/[0.04] transition-all duration-200">
                  <div className="text-lg mb-1.5">{card.icon}</div>
                  <h3 className="text-xs font-semibold text-white mb-0.5">{card.title}</h3>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-6 space-y-6">
            {messages.map((msg, idx) => (
              <MessageBubble key={msg.id || msg._id || idx} message={msg} />
            ))}

            {showThinkingIndicator && <MessageBubble isThinking={true} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Floating pill input */}
      <div className="floating-input-container">
        {messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 mb-1 max-w-full no-scrollbar animate-fade-in-up" style={{ animationDelay: '600ms' }}>
            {[
              { label: '🎓 Universities', query: 'Show me universities that match my profile' },
              { label: '💰 Scholarships', query: 'What scholarships am I eligible for?' },
              { label: '🗺️ Roadmap', query: 'Create my personalized study abroad roadmap' }
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleCardClick(chip.query)}
                disabled={inputDisabled}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#6366F1]/10 border border-[#6366F1]/25 text-[#A5B4FC] hover:bg-[#6366F1]/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {periIsWorking && (
          <AiBusyBanner
            className="mb-2"
            currentTask={aiQueue?.current_task}
            statusMessage={queueBannerMessage}
            showDots={false}
          />
        )}

        {isClosed && (
          <div className="mb-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 text-center font-medium flex items-center justify-center gap-2 flex-wrap">
            <span>Your roadmap is ready — keep chatting anytime or</span>
            <button
              type="button"
              onClick={() => navigate('/roadmap')}
              className="font-bold text-emerald-100 underline hover:text-white"
            >
              view roadmap
            </button>
          </div>
        )}

        <div className={`pill-input-wrapper${inputDisabled ? ' pill-input-wrapper--busy' : ''}`}>
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={input}
            onChange={(e) => { handleTextChange(e); resetInactivityTimer(); }}
            onKeyDown={(e) => { handleKeyDown(e); if (e.key !== 'Shift') resetInactivityTimer(); }}
            onFocus={() => { setIsFocused(true); resetInactivityTimer(); }}
            onBlur={() => setIsFocused(false)}
            placeholder={inputPlaceholder}
            rows={1}
            className="pill-textarea"
            aria-label="Chat message input"
            readOnly={inputDisabled}
          />
          <button
            id="send-message-btn"
            onClick={handleSend}
            disabled={!input.trim() || inputDisabled}
            className="circular-send-btn"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="w-full max-w-[768px] flex items-center justify-between mt-1 px-3">
          <p className="pill-shortcut-hint !mt-0 text-left">Press Enter to send · Shift+Enter for new line</p>
          {(isFocused || input.length > 0) && input.length > 3500 && (
            <span
              style={{
                fontSize: '0.7rem',
                color: getCounterColor(input.length),
                fontWeight: 500,
                letterSpacing: '0.02em',
                transition: 'color 0.2s ease',
              }}
            >
              {input.length.toLocaleString()} / 4,000
            </span>
          )}
        </div>
      </div>

      {/* Task 2: Score Update Toast */}
      {scoreToast && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#6366F1]/90 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-xl backdrop-blur-sm border border-white/10 flex items-center gap-2 animate-fade-in-up">
          <span>🎯 Profile updated! Score: {scoreToast.oldScore} → {scoreToast.newScore}</span>
        </div>
      )}
    </div>
  );
}
