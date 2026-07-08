import React, { useState, useMemo, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext';

import { useChat } from '../context/ChatContext';

import {

  ArrowLeft, Compass, CheckCircle, AlertCircle, Award, ExternalLink,

  ChevronDown, ChevronUp,

} from 'lucide-react';

import MascotLoader from '../components/mascot/MascotLoader';
import AppShell from '../components/AppShell';

const ROADMAP_LOADING_STAGES = [
  { afterMs: 0, message: 'Loading your profile…', step: 0 },
  { afterMs: 30000, message: 'Researching programs and requirements…', step: 1 },
  { afterMs: 90000, message: 'Drafting roadmap phases…', step: 2 },
  { afterMs: 180000, message: 'Still working — first run on CPU can take several minutes…', step: 3 },
];

const ROADMAP_STEPS = [
  'Profile loaded',
  'Searching official sources',
  'Drafting phases',
  'Final review',
];

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



function PhaseStepDetails({ stepDetails }) {

  if (!stepDetails?.length) return null;

  return (

    <div className="space-y-4 pt-2">

      {stepDetails.map((detail, dIdx) => (

        <div

          key={dIdx}

          className="bg-[#16162a]/60 border border-white/10 rounded-xl p-4 space-y-2"

        >

          <div className="flex items-start justify-between gap-3">

            <div className="space-y-1 min-w-0">

              <p className="text-sm font-semibold text-white leading-snug">{detail.title}</p>

              {detail.summary && (

                <p className="text-xs text-slate-400 leading-relaxed">{detail.summary}</p>

              )}

            </div>

            {detail.url && (

              <a

                href={detail.url}

                target="_blank"

                rel="noopener noreferrer"

                onClick={(e) => e.stopPropagation()}

                className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-[#818cf8] hover:text-white bg-[#6366F1]/15 px-2 py-1 rounded-lg"

              >

                Link <ExternalLink className="w-3 h-3" />

              </a>

            )}

          </div>

          {detail.details?.length > 0 && (

            <ol className="space-y-1.5 pl-1 list-none">

              {detail.details.map((line, lIdx) => (

                <li key={lIdx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">

                  <span className="text-[#6366F1] font-bold flex-shrink-0 mt-0.5">{lIdx + 1}.</span>

                  <span>{line}</span>

                </li>

              ))}

            </ol>

          )}

        </div>

      ))}

    </div>

  );

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

  const [expandedPhase, setExpandedPhase] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isGeneratingRoadmap) return undefined;

    setLoadingStage(0);
    setElapsedSec(0);
    const start = Date.now();

    const elapsedTimer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    const stageTimers = ROADMAP_LOADING_STAGES.slice(1).map((stage, idx) =>
      setTimeout(() => setLoadingStage(idx + 1), stage.afterMs),
    );

    return () => {
      clearInterval(elapsedTimer);
      stageTimers.forEach(clearTimeout);
    };
  }, [isGeneratingRoadmap]);



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

      setExpandedPhase(0);

    } catch (err) {

      setError(err.response?.data?.message || err.message || 'Roadmap generation failed. Please try again.');

    }

  };



  const togglePhase = (idx) => {

    setExpandedPhase((prev) => (prev === idx ? null : idx));

  };



  if (isGeneratingRoadmap) {
    const stage = ROADMAP_LOADING_STAGES[loadingStage] || ROADMAP_LOADING_STAGES[0];

    return (
      <MascotLoader
        title="Building your roadmap…"
        subtitle="First run on CPU can take 2–10 minutes. You can leave this tab open."
        message={stage.message}
        elapsedSeconds={elapsedSec}
        etaLabel="2–10 min on CPU"
        steps={ROADMAP_STEPS}
        currentStepIndex={stage.step}
        onCancel={() => navigate('/chat')}
        cancelLabel="Back to chat"
      />
    );
  }



  return (
    <AppShell title="Academic Roadmap">
    <div className="font-sans">
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 space-y-6">

        <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">

          <h2 className="text-xl font-extrabold text-white">Your Study Abroad Roadmap</h2>

          <p className="text-sm text-slate-400">

            Click each phase to expand a step-by-step plan — deadlines, requirements, and what to do at each stage.

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

            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-[#0f0f1a] bg-[#6366F1] hover:bg-[#5558DD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"

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

          <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">

            <div>

              <h3 className="text-base font-bold text-white flex items-center gap-2">

                <Award className="w-5 h-5 text-amber-400" />

                {sessionRoadmap.title || 'Your Custom Roadmap'}

              </h3>

              {sessionRoadmap.overallTimeline && (

                <p className="text-xs text-slate-400 mt-1">{sessionRoadmap.overallTimeline}</p>

              )}

            </div>



            {(sessionRoadmap.gaps?.length > 0 || sessionRoadmap.recommendations?.length > 0) && (

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {sessionRoadmap.gaps?.length > 0 && (

                  <div className="bg-[#0f0f1a] border border-amber-500/20 rounded-xl p-4 space-y-2">

                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Profile gaps</p>

                    <ul className="space-y-1.5">

                      {sessionRoadmap.gaps.map((g, i) => (

                        <li key={i} className="text-xs text-slate-300 flex gap-2">

                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />

                          <span>{g}</span>

                        </li>

                      ))}

                    </ul>

                  </div>

                )}

                {sessionRoadmap.recommendations?.length > 0 && (

                  <div className="bg-[#0f0f1a] border border-emerald-500/20 rounded-xl p-4 space-y-2">

                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Priority actions</p>

                    <ul className="space-y-1.5">

                      {sessionRoadmap.recommendations.map((r, i) => (

                        <li key={i} className="text-xs text-slate-300 flex gap-2">

                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />

                          <span>{r}</span>

                        </li>

                      ))}

                    </ul>

                  </div>

                )}

              </div>

            )}



            <div className="space-y-3">

              {sessionRoadmap.phases.map((p, idx) => {

                const isOpen = expandedPhase === idx;

                const detailCount = p.stepDetails?.length || p.steps?.length || 0;

                return (

                  <div

                    key={idx}

                    className={`bg-[#0f0f1a] border rounded-xl overflow-hidden transition-colors ${

                      isOpen ? 'border-[#6366F1]/40' : 'border-white/5 hover:border-white/15'

                    }`}

                  >

                    <button

                      type="button"

                      onClick={() => togglePhase(idx)}

                      className="w-full text-left p-5 flex items-start gap-3 group"

                    >

                      <div className="flex-1 min-w-0 space-y-2">

                        <div className="flex items-center justify-between gap-2 flex-wrap">

                          <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#6366F1]/20 text-[#818cf8] border border-[#6366F1]/30">

                            Phase {p.phase || idx + 1}

                          </span>

                          {p.timeline && (

                            <span className="text-xs text-slate-400 font-mono">{p.timeline}</span>

                          )}

                        </div>

                        <h4 className="text-sm font-bold text-white group-hover:text-[#818cf8] transition-colors">

                          {p.title}

                        </h4>

                        {!isOpen && p.description && (

                          <p className="text-xs text-slate-400 line-clamp-2">{p.description}</p>

                        )}

                        {!isOpen && detailCount > 0 && (

                          <p className="text-[10px] text-slate-500">

                            {detailCount} detailed step{detailCount !== 1 ? 's' : ''} — click to expand

                          </p>

                        )}

                      </div>

                      <div className="flex-shrink-0 mt-1 text-slate-400 group-hover:text-white">

                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}

                      </div>

                    </button>



                    {isOpen && (

                      <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">

                        {p.description && (

                          <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>

                        )}

                        {p.stepDetails?.length > 0 ? (

                          <PhaseStepDetails stepDetails={p.stepDetails} />

                        ) : p.steps?.length > 0 ? (

                          <ul className="space-y-2">

                            {p.steps.map((st, sIdx) => (

                              <li key={sIdx} className="text-xs text-slate-300 flex items-start gap-2">

                                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />

                                <span>{st}</span>

                              </li>

                            ))}

                          </ul>

                        ) : null}

                      </div>

                    )}

                  </div>

                );

              })}

            </div>

          </div>

        ) : (

          <div className="text-center py-12 text-slate-500 text-sm">

            No roadmap generated yet. Complete your profile checklist and click Generate Roadmap.

          </div>

        )}

      </div>
    </div>
    </AppShell>
  );
}

