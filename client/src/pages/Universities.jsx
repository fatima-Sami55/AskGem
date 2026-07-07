import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext';

import api from '../services/api';

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

import {

  ArrowLeft, GraduationCap, Trophy, Calendar, SlidersHorizontal,

  Check, Bookmark, ExternalLink, AlertCircle, MessageSquare, RefreshCw,

} from 'lucide-react';



const LOADING_STAGES = [
  { afterMs: 0, message: 'Searching…' },
  { afterMs: 15000, message: 'Analyzing your profile…' },
  { afterMs: 45000, message: 'First load can take a few minutes on CPU…' },
];



export default function UniversitiesPage() {

  const { user } = useProfile();

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
    if (!profileReady) {
      setLoading(false);
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
          () => api.get('/profile/recommendations/universities', { signal: controller.signal }),
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
  }, [profileReady, user?.profile?.gpa, user?.profile?.preferredCountries, user?.profile?.targetDegree, user?.profile?.major, refreshKey, cacheKey]);

  const handleRefresh = useCallback(() => {
    setFromCache(false);
    setRefreshKey((k) => k + 1);
  }, []);



  const processedUnis = useMemo(() => universities.map((uni, idx) => ({

    ...uni,

    id: uni.sourceUrl || `uni-${idx}`,

    matchPercent: uni.matchScore ?? null,

    minGpa: uni.minGpa ?? null,

    ieltsMin: uni.ieltsMin ?? null,

    tuitionFee: typeof uni.tuition === 'string' && /free|€0|\$0/i.test(uni.tuition) ? 0 : 1,

  })), [universities]);



  const filteredUnis = processedUnis.filter((uni) => {

    if (countryFilter !== 'All' && uni.country !== countryFilter) return false;

    if (uni.minGpa != null && uni.minGpa > maxGpaFilter) return false;

    if (freeTuitionOnly && uni.tuitionFee > 0) return false;

    return true;

  }).sort((a, b) => {

    if (sortBy === 'match') return (b.matchPercent ?? -1) - (a.matchPercent ?? -1);

    if (sortBy === 'gpa') return (a.minGpa ?? 0) - (b.minGpa ?? 0);

    return a.name.localeCompare(b.name);

  });



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

  if (loading) {
    return (
      <MascotLoader message={LOADING_STAGES[loadingStage]?.message || LOADING_STAGES[0].message} />
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

          <GraduationCap className="w-5 h-5 text-[#6366F1]" /> Universities for {displayName}

        </h1>

        <div className="w-20" />

      </header>



      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-200">Verify before you apply</p>
          <p className="text-xs text-amber-100/90 mt-1">{disclaimer}</p>
          <p className="text-[10px] text-amber-200/70 mt-2">
            Match scores are only shown when Peri can compute them from verified data. Unverified results link to official sources — always confirm requirements yourself.
          </p>
        </div>

        {fromCache && cacheAgeMin != null && (
          <div className="flex items-center justify-between gap-3 bg-[#1E293B]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-400">
            <span>Last updated {cacheAgeMin === 0 ? 'just now' : `${cacheAgeMin} min ago`}</span>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 text-[#818cf8] hover:text-white font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1E293B] border border-white/10 rounded-2xl p-6 shadow-xl">

          <div>

            <h2 className="text-xl font-bold text-white">Personalized University Matches</h2>

            <p className="text-xs text-slate-400 mt-1">

              {profileSummary || `Live recommendations for GPA ${userGpa || 'N/A'} and your study goals.`}

            </p>

          </div>

          {!error && (

            <div className="flex items-center gap-2 bg-[#0F172A] px-4 py-2.5 rounded-xl border border-white/5 text-xs font-semibold text-slate-300">

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

              className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#5558e3] rounded-xl text-xs font-bold transition-colors whitespace-nowrap"

            >

              <MessageSquare className="w-4 h-4" /> Go to Chat

            </Link>

          </div>

        )}



        {!error && universities.length > 0 && (

          <>

            <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">

                <SlidersHorizontal className="w-4 h-4 text-[#6366F1]" /> Filter & Sort

              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                <div className="space-y-1.5">

                  <label className="block text-xs text-slate-400">Country</label>

                  <select

                    value={countryFilter}

                    onChange={(e) => setCountryFilter(e.target.value)}

                    className="w-full bg-[#0F172A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    {countriesList.map((c) => <option key={c} value={c}>{c}</option>)}

                  </select>

                </div>

                <div className="space-y-1.5">

                  <div className="flex justify-between text-xs text-slate-400">

                    <span>Max Min-GPA Req</span>

                    <span className="font-mono text-white font-bold">{maxGpaFilter}</span>

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

                </div>

                <div className="space-y-1.5 flex flex-col justify-end">

                  <button

                    type="button"

                    onClick={() => setFreeTuitionOnly((p) => !p)}

                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${freeTuitionOnly ? 'bg-[#6366F1]/20 border-[#6366F1] text-white' : 'bg-[#0F172A] border-white/10 text-slate-400'}`}

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

                    className="w-full bg-[#0F172A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    <option value="match">Highest Match %</option>

                    <option value="gpa">Lowest GPA Requirement</option>

                    <option value="name">Name (A–Z)</option>

                  </select>

                </div>

              </div>

            </div>



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

                    className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 hover:border-[#6366F1]/50 transition-all flex flex-col justify-between"

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

                          className={`p-2 rounded-xl border transition-all ${isSaved ? 'bg-indigo-500/20 border-[#6366F1] text-[#6366F1]' : 'bg-[#0F172A] border-white/10 text-slate-400 hover:text-white'}`}

                        >

                          <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />

                        </button>

                      </div>



                      <div className="bg-[#0F172A] p-3 rounded-xl border border-white/5 space-y-1.5">

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

                        <div className="bg-[#0F172A]/60 p-2.5 rounded-lg border border-white/5 text-slate-300">

                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Requirements</span>

                          <span className="font-semibold">

                            {uni.minGpa != null ? `GPA ${uni.minGpa}+` : 'GPA: verify'}

                            {uni.ieltsMin != null ? ` | IELTS ${uni.ieltsMin}+` : ''}

                          </span>

                        </div>

                        <div className="bg-[#0F172A]/60 p-2.5 rounded-lg border border-white/5 text-slate-300">

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

            <p className="text-slate-400 text-sm">No matches yet. Complete your profile in chat first.</p>

            <Link to="/chat" className="inline-flex items-center gap-2 text-[#818cf8] text-sm font-semibold hover:underline">

              <MessageSquare className="w-4 h-4" /> Chat with Peri

            </Link>

          </div>

        )}

      </div>

    </div>

  );

}


