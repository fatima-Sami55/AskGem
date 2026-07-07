import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useChat } from '../context/ChatContext';
import {
  ArrowLeft, Compass, CheckCircle, AlertCircle, Award,
} from 'lucide-react';
import MascotLoader from '../components/mascot/MascotLoader';

function getProfileChecklist(profile) {
  const items = [
    { key: 'gpa', label: 'CGPA', done: profile?.gpa != null },
    { key: 'targetDegree', label: 'Target degree', done: Boolean(profile?.targetDegree) },
    { key: 'major', label: 'Field of study', done: Boolean(profile?.major) },
    {
      key: 'preferredCountries',
      label: 'Preferred countries',
      done: Array.isArray(profile?.preferredCountries) && profile.preferredCountries.length > 0,
    },
  ];
  return items;
}

export default function RoadmapPage() {
  const { user } = useProfile();
  const {
    generatedRoadmap,
    recommendations,
    activeSessionId,
    sessions,
    generateRoadmap,
    isGeneratingRoadmap,
    aiQueueBlocksSend,
  } = useChat();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const userProfile = user?.profile || {};
  const checklist = useMemo(() => getProfileChecklist(userProfile), [userProfile]);
  const profileComplete = checklist.every((item) => item.done);
  const missingItems = checklist.filter((item) => !item.done);

  const sessionRoadmap = generatedRoadmap || recommendations?.roadmap || null;
  const sessionId = activeSessionId || sessions[0]?._id;

  const handleGenerate = async () => {
    if (!sessionId || !profileComplete) return;
    setError(null);
    try {
      await generateRoadmap(sessionId);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Roadmap generation failed. Please try again.');
    }
  };

  if (isGeneratingRoadmap) {
    return (
      <MascotLoader message="Generating your personalized roadmap — this can take a few minutes on first run..." />
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-sans">
      <header className="sticky top-0 z-20 bg-[#1E293B]/90 backdrop-blur border-b border-white/10 px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#6366F1]" /> Back to Chat
        </button>
        <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#6366F1]" /> Academic Roadmap
        </h1>
        <div className="w-20" />
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-extrabold text-white">Your Study Abroad Roadmap</h2>
          <p className="text-sm text-slate-400">
            Roadmaps are generated on demand — Peri will not create one until you click Generate.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile checklist</p>
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                )}
                <span className={item.done ? 'text-slate-300' : 'text-amber-200'}>
                  {item.label}{item.done ? '' : ' — missing'}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!profileComplete || !sessionId || aiQueueBlocksSend}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#6366F1] hover:bg-[#5558e3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" />
            Generate Roadmap
          </button>

          {!profileComplete && missingItems.length > 0 && (
            <p className="text-xs text-slate-500 text-center">
              Complete {missingItems.map((m) => m.label.toLowerCase()).join(', ')} in chat before generating.
            </p>
          )}
        </div>

        {sessionRoadmap?.phases?.length > 0 ? (
          <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                {sessionRoadmap.title || 'Your Custom Roadmap'}
              </h3>
              {sessionRoadmap.overallTimeline && (
                <p className="text-xs text-slate-400 mt-1">{sessionRoadmap.overallTimeline}</p>
              )}
            </div>
            <div className="space-y-6">
              {sessionRoadmap.phases.map((p, idx) => (
                <div key={idx} className="bg-[#0F172A] border border-white/5 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#6366F1]/20 text-[#818cf8] border border-[#6366F1]/30">
                      Phase {p.phase || idx + 1}
                    </span>
                    {p.timeline && <span className="text-xs text-slate-400 font-mono">{p.timeline}</span>}
                  </div>
                  <h4 className="text-sm font-bold text-white">{p.title}</h4>
                  {p.description && <p className="text-xs text-slate-400">{p.description}</p>}
                  {p.steps && (
                    <ul className="space-y-2 pt-1">
                      {p.steps.map((st, sIdx) => (
                        <li key={sIdx} className="text-xs text-slate-300 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{st}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 text-sm">
            No roadmap generated yet. Complete your profile checklist and click Generate Roadmap.
          </div>
        )}
      </div>
    </div>
  );
}
