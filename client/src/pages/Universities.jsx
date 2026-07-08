import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext';
import { useChat } from '../context/ChatContext';
import api from '../services/api';
import AiBusyBanner from '../components/features/AiBusyBanner';
import RecommendationsBusyState from '../components/features/RecommendationsBusyState';

import {
  fetchRecommendationsCached,
  getRecommendationsCacheKey,
  getCacheAgeMinutes,
  getCachedEntry,
  subscribeRecommendationsCache,
} from '../services/recommendationsCache';
import { isProfileReadyForRecommendations } from '../utils/profileGates';
import { loadBookmarks, toggleBookmark, isBookmarked } from '../services/bookmarks';
import ProfileIncompleteState from '../components/features/ProfileIncompleteState';

import MascotLoader from '../components/mascot/MascotLoader';
import AppShell from '../components/AppShell';

import {

  ArrowLeft, GraduationCap, Trophy, Calendar, SlidersHorizontal,

  Check, Bookmark, ExternalLink, AlertCircle, MessageSquare, RefreshCw,

} from 'lucide-react';



const LOADING_STAGES = [
  { afterMs: 0, message: 'Searching…' },
  { afterMs: 15000, message: 'Analyzing your profile…' },
  { afterMs: 45000, message: 'First load can take a few minutes on CPU…' },
];

function canonicalUniKey(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./i, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return (url || '').toLowerCase();
  }
}

function normalizeUniName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTuitionFree(tuition) {
  if (!tuition || typeof tuition !== 'string') return false;
  return /tuition[- ]free|no tuition|free tuition|semester (?:fee|contribution) only|public university|€\s*0|0\s*eur|low \/ tuition-free/i.test(tuition);
}



export default function UniversitiesPage() {

  const { user } = useProfile();
  const { aiQueueBlocksSend, aiQueue } = useChat();

  const navigate = useNavigate();

  const profileReady = isProfileReadyForRecommendations(user);



  const [universities, setUniversities] = useState([]);

  const [profileSummary, setProfileSummary] = useState('');

  const [disclaimer, setDisclaimer] = useState('Verify all details on official university websites.');

  const [error, setError] = useState(null);

  const [loading, setLoading] = useState(profileReady);
  const [loadingStage, setLoadingStage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cacheAgeMin, setCacheAgeMin] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const [countryFilter, setCountryFilter] = useState('All');

  const [maxGpaFilter, setMaxGpaFilter] = useState(4.0);

  const [freeTuitionOnly, setFreeTuitionOnly] = useState(false);

  const [sortBy, setSortBy] = useState('match');

  const [savedUnis, setSavedUnis] = useState({});

  useEffect(() => {
    const store = loadBookmarks();
    const map = {};
    store.universities.forEach((b) => { map[b.sourceUrl] = true; });
    setSavedUnis(map);
  }, []);

  useEffect(() => {
    return subscribeRecommendationsCache(() => setRefreshKey((k) => k + 1));
  }, []);

  const displayName = user?.name || 'there';
  const userGpa = user?.profile?.gpa;
  const cacheKey = getRecommendationsCacheKey('universities');

  useEffect(() => {
    if (userGpa != null && !Number.isNaN(Number(userGpa))) {
      setMaxGpaFilter(Number(userGpa));
    }
  }, [userGpa]);

  useEffect(() => {
    if (!profileReady || aiQueueBlocksSend) {
      if (!profileReady) setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoadingStage(0);
    setFromCache(false);

    const stageTimers = LOADING_STAGES.slice(1).map((stage, idx) =>
      setTimeout(() => setLoadingStage(idx + 1), stage.afterMs),
    );

    const fetchRecommendations = async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      const hadCache = Boolean(getCachedEntry(cacheKey));
      if (hadCache && !forceRefresh) {
        setFromCache(true);
        setCacheAgeMin(getCacheAgeMinutes(cacheKey));
      }

      try {
        const res = await fetchRecommendationsCached(
          cacheKey,
          () => api.get('/profile/recommendations/universities', {
            signal: controller.signal,
            params: forceRefresh ? { refresh: 'true' } : undefined,
          }),
          { forceRefresh },
        );

        if (controller.signal.aborted) return;

        const data = res.data?.data || {};

        setUniversities(data.universities || []);
        setProfileSummary(data.profileSummary || '');
        setDisclaimer(data.disclaimer || 'Verify all details on official university websites.');
        setCacheAgeMin(getCacheAgeMinutes(cacheKey));
        setFromCache(hadCache && !forceRefresh);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(err.response?.data?.message || 'Could not load personalized recommendations.');
        setUniversities([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchRecommendations(refreshKey > 0);
    return () => {
      stageTimers.forEach(clearTimeout);
      controller.abort();
    };
  }, [profileReady, aiQueueBlocksSend, user?.profile?.gpa, user?.profile?.preferredCountries, user?.profile?.targetDegree, user?.profile?.major, refreshKey, cacheKey]);

  const handleRefresh = useCallback(() => {
    setFromCache(false);
    setRefreshKey((k) => k + 1);
  }, []);



  const processedUnis = useMemo(() => {
    const seen = new Set();
    return universities.reduce((acc, uni, idx) => {
      const urlKey = uni.sourceUrl ? canonicalUniKey(uni.sourceUrl) : '';
      const nameKey = normalizeUniName(uni.name);
      const dedupeKey = urlKey || nameKey || `idx-${idx}`;
      if (seen.has(dedupeKey)) return acc;
      seen.add(dedupeKey);

      acc.push({
        ...uni,
        id: urlKey || nameKey || `uni-${idx}`,
        matchPercent: uni.matchScore ?? null,
        minGpa: uni.minGpa != null ? Number(uni.minGpa) : null,
        ieltsMin: uni.ieltsMin != null ? Number(uni.ieltsMin) : null,
        tuitionFree: isTuitionFree(uni.tuition),
      });
      return acc;
    }, []);
  }, [universities]);

  const filteredUnis = useMemo(() => processedUnis.filter((uni) => {
    if (countryFilter !== 'All' && uni.country !== countryFilter) return false;
    if (uni.minGpa != null && uni.minGpa > maxGpaFilter) return false;
    if (freeTuitionOnly && !uni.tuitionFree) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'match') return (b.matchPercent ?? -1) - (a.matchPercent ?? -1);
    if (sortBy === 'gpa') return (a.minGpa ?? 999) - (b.minGpa ?? 999);
    return a.name.localeCompare(b.name);
  }), [processedUnis, countryFilter, maxGpaFilter, freeTuitionOnly, sortBy]);



  const countriesList = ['All', ...new Set(universities.map((u) => u.country).filter(Boolean))];



  const toggleSave = (uni) => {
    const saved = toggleBookmark('universities', { name: uni.name, sourceUrl: uni.sourceUrl || uni.id });
    setSavedUnis((prev) => {
      const next = { ...prev };
      const key = uni.sourceUrl || uni.id;
      if (saved) next[key] = true;
      else delete next[key];
      return next;
    });
  };



  if (!profileReady) {
    return (
      <ProfileIncompleteState
        title="Complete your profile first"
        description="University recommendations need your CGPA, target degree, and at least one preferred country."
      />
    );
  }

  if (profileReady && aiQueueBlocksSend && universities.length === 0 && !fromCache) {
    return (
      <RecommendationsBusyState
        title={`Universities for ${displayName}`}
        icon={GraduationCap}
        currentTask={aiQueue?.current_task}
        itemLabel="university recommendations"
      />
    );
  }

  if (loading) {
    return (
      <MascotLoader message={LOADING_STAGES[loadingStage]?.message || LOADING_STAGES[0].message} />
    );
  }



  return (

    <AppShell title={`Universities for ${displayName}`}>
    <div className="font-sans">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-200">Verify before you apply</p>
          <p className="text-xs text-amber-100/90 mt-1">{disclaimer}</p>
          <p className="text-[10px] text-amber-200/70 mt-2">
            Links go to official university websites only. Match scores appear when Peri can compute them from verified data.
          </p>
        </div>

        {aiQueueBlocksSend && (
          <AiBusyBanner currentTask={aiQueue?.current_task} />
        )}

        {fromCache && cacheAgeMin != null && (
          <div className="flex items-center justify-between gap-3 bg-[#16162a]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-400">
            <span>Last updated {cacheAgeMin === 0 ? 'just now' : `${cacheAgeMin} min ago`}</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={aiQueueBlocksSend}
              className="inline-flex items-center gap-1.5 text-[#818cf8] hover:text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#16162a] border border-white/10 rounded-2xl p-6 shadow-xl">

          <div>

            <h2 className="text-xl font-bold text-white">Personalized University Matches</h2>

            <p className="text-xs text-slate-400 mt-1">

              {profileSummary || `Live recommendations for GPA ${userGpa || 'N/A'} and your study goals.`}

            </p>

          </div>

          {!error && (

            <div className="flex items-center gap-2 bg-[#0f0f1a] px-4 py-2.5 rounded-xl border border-white/5 text-xs font-semibold text-slate-300">

              <Trophy className="w-4 h-4 text-amber-400" />

              {filteredUnis.length} match{filteredUnis.length !== 1 ? 'es' : ''} found

            </div>

          )}

        </div>



        {error && (

          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

            <div className="flex items-start gap-3">

              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />

              <div>

                <p className="text-sm font-semibold text-red-300">{error}</p>

                <p className="text-xs text-slate-400 mt-1">

                  Chat with Peri to build your profile, then return here for live matches.

                </p>

              </div>

            </div>

            <Link

              to="/chat"

              className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#5558DD] text-[#0f0f1a] rounded-xl text-xs font-bold transition-colors whitespace-nowrap"

            >

              <MessageSquare className="w-4 h-4" /> Go to Chat

            </Link>

          </div>

        )}



        {!error && universities.length > 0 && (

          <>

            <div className="bg-[#16162a] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">

                <SlidersHorizontal className="w-4 h-4 text-[#6366F1]" /> Filter & Sort

              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                <div className="space-y-1.5">

                  <label className="block text-xs text-slate-400">Country</label>

                  <select

                    value={countryFilter}

                    onChange={(e) => setCountryFilter(e.target.value)}

                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    {countriesList.map((c) => <option key={c} value={c}>{c}</option>)}

                  </select>

                </div>

                <div className="space-y-1.5">

                  <div className="flex justify-between text-xs text-slate-400">

                    <span>Max required GPA</span>

                    <span className="font-mono text-white font-bold">{maxGpaFilter.toFixed(1)}</span>

                  </div>

                  <input

                    type="range"

                    min="2.5"

                    max="4.0"

                    step="0.1"

                    value={maxGpaFilter}

                    onChange={(e) => setMaxGpaFilter(Number(e.target.value))}

                    className="w-full accent-[#6366F1]"

                  />
                  <p className="text-[10px] text-slate-500">Shows programs requiring at most this GPA. Unknown requirements stay visible.</p>

                </div>

                <div className="space-y-1.5 flex flex-col justify-end">

                  <button

                    type="button"

                    onClick={() => setFreeTuitionOnly((p) => !p)}
                    aria-pressed={freeTuitionOnly}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${freeTuitionOnly ? 'bg-[#6366F1]/20 border-[#6366F1] text-white' : 'bg-[#0f0f1a] border-white/10 text-slate-400'}`}
                  >
                    <span>Tuition-Free Only</span>
                    {freeTuitionOnly && <Check className="w-3.5 h-3.5 text-[#6366F1]" />}
                  </button>

                </div>

                <div className="space-y-1.5">

                  <label className="block text-xs text-slate-400">Sort By</label>

                  <select

                    value={sortBy}

                    onChange={(e) => setSortBy(e.target.value)}

                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    <option value="match">Highest Match %</option>

                    <option value="gpa">Lowest GPA Requirement</option>

                    <option value="name">Name (A–Z)</option>

                  </select>

                </div>

              </div>

            </div>



            {filteredUnis.length === 0 && (
              <div className="text-center py-10 bg-[#16162a] border border-white/10 rounded-2xl">
                <p className="text-sm text-slate-300">No universities match your current filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setCountryFilter('All');
                    setFreeTuitionOnly(false);
                    setMaxGpaFilter(userGpa != null ? Number(userGpa) : 4.0);
                    setSortBy('match');
                  }}
                  className="mt-3 text-xs font-semibold text-[#818cf8] hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {filteredUnis.map((uni) => {

                const hasScore = uni.matchPercent != null;
                const matchColor = hasScore
                  ? (uni.matchPercent >= 80 ? '#10B981' : uni.matchPercent >= 60 ? '#F59E0B' : '#3B82F6')
                  : '#64748B';
                const isSaved = Boolean(savedUnis[uni.sourceUrl || uni.id]) || isBookmarked('universities', uni.sourceUrl);



                return (

                  <div

                    key={uni.id}

                    className="bg-[#16162a] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 hover:border-[#6366F1]/50 transition-all flex flex-col justify-between"

                  >

                    <div className="space-y-3">

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <h3 className="text-base font-bold text-white leading-snug">{uni.name}</h3>

                          <p className="text-xs text-slate-400 mt-1">{uni.country}{uni.program ? ` • ${uni.program}` : ''}</p>

                          {uni.verified === false && (
                            <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Unverified — check official site
                            </span>
                          )}

                        </div>

                        <button

                          type="button"

                          onClick={() => toggleSave(uni)}

                          className={`p-2 rounded-xl border transition-all ${isSaved ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]' : 'bg-[#0f0f1a] border-white/10 text-slate-400 hover:text-white'}`}

                        >

                          <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />

                        </button>

                      </div>



                      <div className="bg-[#0f0f1a] p-3 rounded-xl border border-white/5 space-y-1.5">

                        <div className="flex justify-between items-center text-xs">

                          <span className="text-slate-400 font-medium">Profile Match</span>

                          {hasScore ? (
                            <span className="font-bold font-mono" style={{ color: matchColor }}>{uni.matchPercent}%</span>
                          ) : (
                            <span className="font-medium text-slate-500">Not scored</span>
                          )}

                        </div>

                        {hasScore && (
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${uni.matchPercent}%`, backgroundColor: matchColor }} />
                          </div>
                        )}

                      </div>



                      <p className="text-xs text-slate-300 leading-relaxed">{uni.whyItFits}</p>



                      <div className="grid grid-cols-2 gap-2 text-xs">

                        <div className="bg-[#0f0f1a]/60 p-2.5 rounded-lg border border-white/5 text-slate-300">

                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Requirements</span>

                          <span className="font-semibold">

                            {uni.minGpa != null ? `GPA ${uni.minGpa}+` : 'GPA: verify'}

                            {uni.ieltsMin != null ? ` | IELTS ${uni.ieltsMin}+` : ''}

                          </span>

                        </div>

                        <div className="bg-[#0f0f1a]/60 p-2.5 rounded-lg border border-white/5 text-slate-300">

                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Tuition</span>

                          <span className="font-semibold text-emerald-400">{uni.tuition || 'Verify on site'}</span>

                        </div>

                      </div>

                    </div>



                    <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">

                      <span className="text-slate-500 flex items-center gap-1">

                        <Calendar className="w-3.5 h-3.5" /> Check deadlines on official site

                      </span>

                      {uni.sourceUrl && (

                        <a

                          href={uni.sourceUrl}

                          target="_blank"

                          rel="noopener noreferrer"

                          className="px-3 py-1.5 bg-[#6366F1]/20 hover:bg-[#6366F1]/30 text-[#818cf8] font-bold rounded-lg transition-colors flex items-center gap-1"

                        >

                          Official Site <ExternalLink className="w-3 h-3" />

                        </a>

                      )}

                    </div>

                  </div>

                );

              })}

            </div>

          </>

        )}



        {!error && universities.length === 0 && (

          <div className="text-center py-16 space-y-4">

            <GraduationCap className="w-12 h-12 text-slate-600 mx-auto" />

            <p className="text-slate-400 text-sm">No university matches returned this time.</p>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Try refreshing, or chat with Peri to refine your target countries and field of study.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={aiQueueBlocksSend}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#5558DD] text-[#0f0f1a] rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <Link to="/chat" className="inline-flex items-center gap-2 text-[#818cf8] text-sm font-semibold hover:underline">
                <MessageSquare className="w-4 h-4" /> Chat with Peri
              </Link>
            </div>

          </div>

        )}

      </div>

    </div>
    </AppShell>
  );
}


