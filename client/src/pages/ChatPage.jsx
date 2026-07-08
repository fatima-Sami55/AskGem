import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useChat } from '../context/ChatContext';
import InteractiveMascot from '../components/mascot/InteractiveMascot';
import { useMascot } from '../context/MascotContext';
import api from '../services/api';
import ChatWindow from '../components/chat/ChatWindow';
import { AppNavLinks } from '../components/AppShell';
import { MessageSquare, Plus, Trash2, Menu, ChevronLeft, ChevronRight } from 'lucide-react';

function getSessionTitle(session, fallback) {
  const firstUser = session.messages?.find((m) => m.role === 'user' && m.content?.trim());
  if (firstUser) {
    const text = firstUser.content.trim().replace(/\s+/g, ' ');
    return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  }
  return fallback;
}

function SessionItem({ session, sessionName, isActive, onSelect, onDeleteRequest }) {
  const date = new Date(session.updatedAt || session.createdAt).toLocaleDateString();
  const msgCount = session.messages?.length || 0;
  const details = msgCount > 0 ? `${msgCount} message${msgCount !== 1 ? 's' : ''}` : 'New session';

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group relative transition-all duration-150 focus-within:ring-1 focus-within:ring-[#6366F1]/40 ${
        isActive
          ? 'bg-[#6366F1]/10 border border-[#6366F1]/20'
          : 'hover:bg-white/5 text-slate-300'
      }`}
      onClick={() => onSelect(session._id)}
    >
      <MessageSquare
        className={`w-4 h-4 flex-shrink-0 transition-colors ${
          isActive ? 'text-[#6366F1]' : 'text-slate-400 group-hover:text-[#6366F1]'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 justify-between">
          <p className={`text-xs font-semibold truncate ${isActive ? 'text-[#6366F1]' : ''}`}>
            {sessionName}
          </p>
          {session.isClosed && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
              Closed
            </span>
          )}
        </div>
        <p className="text-[10px] truncate" style={{ color: 'var(--text-subtle)' }}>
          {details ? `${details} · ${date}` : date}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRequest(session._id, sessionName);
        }}
        className="opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6366F1]"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(222,62,62,0.1)'; e.currentTarget.style.color = '#DE3E3E'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        aria-label={`Delete session ${sessionName}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ChatPage() {
  const { triggerMascotAction } = useMascot();
  const { sessions, activeSessionId, fetchSessions, createSession, loadSession, deleteSession, profileScoreData, lastScoreUpdated, fetchProfileScore } = useChat();
  const navigate = useNavigate();

  // sidebarOpen: on mobile controls overlay; on desktop controls collapsed state
  const [sidebarOpen, setSidebarOpen] = useState(true);   // desktop: expanded by default
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [localScoreData, setLocalScoreData] = useState(null);
  const [, setTick] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteRequest = (sessionId, sessionName) => {
    setDeleteTarget({ id: sessionId, name: sessionName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSession(deleteTarget.id);
    setDeleteTarget(null);
  };

  const scoreData = profileScoreData || localScoreData;

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileScoreData) {
      if (fetchProfileScore) {
        fetchProfileScore();
      } else {
        api.get('/profile/score')
          .then(res => {
            if (res.data?.data) {
              setLocalScoreData(res.data.data);
            }
          })
          .catch(err => console.error('Failed to fetch sidebar score:', err));
      }
    }
  }, [profileScoreData, fetchProfileScore]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // On first load, if there are sessions, auto-select the most recent one.
  // Do NOT auto-create — let the user press "New Session" themselves,
  // so deletions are not silently undone on mount.
  const [sessionAutoLoaded, setSessionAutoLoaded] = useState(false);
  useEffect(() => {
    if (!sessionAutoLoaded && !activeSessionId && sessions.length > 0) {
      loadSession(sessions[0]._id);
      setSessionAutoLoaded(true);
    }
  }, [sessions, activeSessionId, sessionAutoLoaded]);

  const handleSelectSession = (id) => {
    loadSession(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--bg-primary)] text-[var(--text-main)]">

      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="chat-sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      {/* Desktop: collapsible via sidebarOpen. Mobile: slide-in overlay via mobileSidebarOpen */}
      <aside
        className={`chat-sidebar flex-shrink-0 flex-col transition-all duration-300
          ${mobileSidebarOpen ? 'open' : ''}
        `}
        style={{
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--bg-secondary)',
          /* Desktop width: 240px when open, 0 (hidden) when collapsed */
          width: sidebarOpen ? '240px' : '0px',
          overflow: sidebarOpen ? 'visible' : 'hidden',
        }}
      >
        {/* Sidebar inner — keeps content from squishing during collapse */}
        <div className="flex flex-col h-full w-60">

          <div className="px-4 py-5 border-b flex items-center flex-shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center gap-2">
              <img
                src="/favicon.png"
                alt="Peri"
                style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }}
              />
              <span className="text-sm font-extrabold text-[var(--text-main)]">
                Ask<span style={{ color: '#6366F1' }}>Peri</span>
              </span>
            </div>
          </div>

          {/* New Session button */}
          <div className="px-3 py-3 flex-shrink-0">
            <button
              id="sidebar-new-chat"
              onClick={() => { createSession(); setMobileSidebarOpen(false); }}
              className="btn-primary w-full text-xs py-2.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Session
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              Recent Sessions
            </p>
            {sessions.length === 0 ? (
              <p className="text-xs px-2 py-2" style={{ color: 'var(--text-subtle)' }}>No sessions yet</p>
            ) : (() => {
              const sortedSessions = [...sessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
              return sessions.map(s => {
                const chronologicalIndex = sortedSessions.findIndex(x => x._id === s._id);
                const sessionNum = chronologicalIndex !== -1 ? chronologicalIndex + 1 : '';
                const sessionName = getSessionTitle(s, `Session ${sessionNum}`);
                return (
                  <SessionItem
                    key={s._id}
                    session={s}
                    sessionName={sessionName}
                    isActive={activeSessionId === s._id}
                    onSelect={handleSelectSession}
                    onDeleteRequest={handleDeleteRequest}
                  />
                );
              });
            })()}
          </div>

          {/* Bottom section: ZONE 1, ZONE 2, ZONE 3 */}
          <div className="px-3 py-3 border-t border-white/10 flex-shrink-0 space-y-3">

            {/* ZONE 1 — Navigation Links */}
            <AppNavLinks onNavigate={() => setMobileSidebarOpen(false)} />

            {/* ZONE 2 — Compact Score Bar */}
            <div className="pt-3 border-t border-white/10">
              <div
                onClick={() => navigate('/profile')}
                className="p-2.5 rounded-xl bg-black/20 border border-white/10 hover:border-[#6366F1]/50 transition-all cursor-pointer space-y-1.5 flex flex-col justify-center min-h-[75px]"
              >
                {scoreData?.score !== undefined && scoreData?.score !== null ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] leading-none">
                      <span className="font-semibold text-slate-300">Profile Score</span>
                      <span
                        className="font-mono font-bold"
                        style={{
                          color: scoreData.score >= 70 ? '#10B981' : scoreData.score >= 40 ? '#F59E0B' : '#EF4444'
                        }}
                      >
                        {scoreData.score}/100
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6366F1] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, scoreData.score)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 leading-none pt-0.5">
                      <span>Profile Strength:</span>
                      <span
                        className="font-semibold font-mono"
                        style={{
                          color: scoreData.admissionChance >= 70 ? '#10B981' : scoreData.admissionChance >= 40 ? '#F59E0B' : '#EF4444'
                        }}
                      >
                        {scoreData.admissionChance}%
                      </span>
                    </div>
                    {lastScoreUpdated && (
                      <div className="flex items-center justify-end leading-none pt-0.5">
                        {(() => {
                          const elapsedSec = Math.floor((Date.now() - lastScoreUpdated) / 1000);
                          if (elapsedSec < 30) {
                            return (
                              <span className="text-[0.7rem] text-[#64748B] flex items-center gap-1 font-medium">
                                Updated just now <span className="text-[#34D399] font-bold">✓</span>
                              </span>
                            );
                          }
                          const min = Math.max(1, Math.floor(elapsedSec / 60));
                          return (
                            <span className="text-[0.7rem] text-[#64748B] font-medium">
                              Updated {min} min ago
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-1 space-y-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6366F1] text-[#0f0f1a] text-xs font-bold hover:bg-[#5558DD] transition-colors"
                    >
                      Complete your profile →
                    </button>
                    <p className="text-[10px] text-slate-400 mt-0.5">Unlock heuristic profile score</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </aside>

      {/* ═══════════ MAIN AREA ═══════════ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar — always visible, contains collapse toggle + mobile menu */}
        <div
          className="flex items-center gap-2 px-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', height: '56px' }}
        >
          {/* Desktop: collapse/expand sidebar toggle */}
          <button
            className="hidden lg:flex items-center justify-center p-2 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(57,177,209,0.08)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {sidebarOpen
              ? <ChevronLeft className="w-5 h-5" style={{ color: '#6366F1' }} />
              : <ChevronRight className="w-5 h-5" style={{ color: '#6366F1' }} />
            }
          </button>

          {/* Mobile: hamburger */}
          <button
            id="sidebar-toggle-btn"
            className="flex lg:hidden items-center justify-center p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
            style={{ color: 'var(--text-muted)' }}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand (shown when sidebar collapsed or on mobile) */}
          {!sidebarOpen && (
            <div className="hidden lg:flex items-center gap-2">
              <img
                src="/favicon.png"
                alt="Peri"
                style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 6 }}
              />
              <span className="text-sm font-extrabold text-[var(--text-main)]">
                Ask<span style={{ color: '#6366F1' }}>Peri</span>
              </span>
            </div>
          )}
          <div className="flex lg:hidden items-center gap-2 flex-1">
            <img
              src="/favicon.png"
              alt="Peri"
              style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 6 }}
            />
            <span className="text-sm font-extrabold text-[var(--text-main)]">
              Ask<span style={{ color: '#6366F1' }}>Peri</span>
            </span>
          </div>
        </div>

        {/* Chat area fills remaining space */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div
            className="flex-shrink-0 px-4 py-2 text-center text-[11px] text-slate-400 border-b border-white/5 bg-[#0f0f1a]/80"
            role="note"
          >
            AI-generated guidance. Verify deadlines and requirements on official university websites.
          </div>
          <ChatWindow />
        </div>
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-session-title">
          <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h2 id="delete-session-title" className="text-base font-bold text-white">Delete session?</h2>
            <p className="text-sm text-slate-300">
              &ldquo;{deleteTarget.name}&rdquo; and its messages will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
