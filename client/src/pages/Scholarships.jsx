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
import AppShell from '../components/AppShell';

import {

  ArrowLeft, Award, Calendar, SlidersHorizontal, Bookmark,

  ExternalLink, AlertCircle, MessageSquare, RefreshCw,

} from 'lucide-react';

import MascotLoader from '../components/mascot/MascotLoader';

const LOADING_STAGES = [
  { afterMs: 0, message: 'Searching…' },
  { afterMs: 15000, message: 'Analyzing your profile…' },
  { afterMs: 45000, message: 'First load can take a few minutes on CPU…' },
];



export default function ScholarshipsPage() {

  const { user } = useProfile();
  const { aiQueueBlocksSend, aiQueue } = useChat();

  const navigate = useNavigate();

  const profileReady = isProfileReadyForRecommendations(user);

  const [scholarships, setScholarships] = useState([]);

  const [profileSummary, setProfileSummary] = useState('');

  const [disclaimer, setDisclaimer] = useState('Verify eligibility and deadlines on official scholarship portals.');

  const [error, setError] = useState(null);

  const [loading, setLoading] = useState(profileReady);
  const [loadingStage, setLoadingStage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cacheAgeMin, setCacheAgeMin] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const [countryFilter, setCountryFilter] = useState('All');

  const [fundingFilter, setFundingFilter] = useState('All');

  const [sortBy, setSortBy] = useState('match');

  const [savedScholarships, setSavedScholarships] = useState({});

  useEffect(() => {
    const store = loadBookmarks();
    const map = {};
    store.scholarships.forEach((b) => { map[b.sourceUrl] = true; });
    setSavedScholarships(map);
  }, []);

  useEffect(() => {
    return subscribeRecommendationsCache(() => setRefreshKey((k) => k + 1));
  }, []);

  const displayName = user?.name || 'there';
  const cacheKey = getRecommendationsCacheKey('scholarships');

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
          () => api.get('/profile/recommendations/scholarships', {
            signal: controller.signal,
            params: forceRefresh ? { refresh: 'true' } : undefined,
          }),
          { forceRefresh },
        );

        if (controller.signal.aborted) return;

        const data = res.data?.data || {};

        setScholarships(data.scholarships || []);
        setProfileSummary(data.profileSummary || '');
        setDisclaimer(data.disclaimer || 'Verify eligibility and deadlines on official scholarship portals.');
        setCacheAgeMin(getCacheAgeMinutes(cacheKey));
        setFromCache(hadCache && !forceRefresh);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(err.response?.data?.message || 'Could not load personalized scholarships.');
        setScholarships([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchRecommendations(refreshKey > 0);
    return () => {
      stageTimers.forEach(clearTimeout);
      controller.abort();
    };
  }, [profileReady, aiQueueBlocksSend, user?.profile?.gpa, user?.profile?.preferredCountries, user?.profile?.targetDegree, refreshKey, cacheKey]);

  const handleRefresh = useCallback(() => {
    setFromCache(false);
    setRefreshKey((k) => k + 1);
  }, []);



  const filteredScholarships = useMemo(() => scholarships.filter((item) => {

    if (countryFilter !== 'All' && item.country !== countryFilter) return false;

    if (fundingFilter !== 'All' && item.fundingType !== fundingFilter) return false;

    return true;

  }).sort((a, b) => {

    if (sortBy === 'match') return (b.matchScore ?? -1) - (a.matchScore ?? -1);

    if (sortBy === 'name') return a.name.localeCompare(b.name);

    return 0;

  }), [scholarships, countryFilter, fundingFilter, sortBy]);



  const countriesList = ['All', ...new Set(scholarships.map((s) => s.country).filter(Boolean))];



  const toggleSave = (item, id) => {
    const saved = toggleBookmark('scholarships', { name: item.name, sourceUrl: item.sourceUrl || id });
    const key = item.sourceUrl || id;
    setSavedScholarships((prev) => {
      const next = { ...prev };
      if (saved) next[key] = true;
      else delete next[key];
      return next;
    });
  };



  if (!profileReady) {
    return (
      <ProfileIncompleteState
        title="Complete your profile first"
        description="Scholarship recommendations need your CGPA, target degree, and at least one preferred country."
      />
    );
  }

  if (profileReady && aiQueueBlocksSend && scholarships.length === 0 && !fromCache) {
    return (
      <RecommendationsBusyState
        title={`Scholarships for ${displayName}`}
        icon={Award}
        iconClassName="text-amber-400"
        currentTask={aiQueue?.current_task}
        itemLabel="scholarship recommendations"
      />
    );
  }

  if (loading) {
    return (
      <MascotLoader message={LOADING_STAGES[loadingStage]?.message || LOADING_STAGES[0].message} />
    );
  }



  return (
    <AppShell title={`Scholarships for ${displayName}`}>
    <div className="font-sans">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-200">Verify before you apply</p>
          <p className="text-xs text-amber-100/90 mt-1">{disclaimer}</p>
          <p className="text-[10px] text-amber-200/70 mt-2">
            Match scores are only shown when Peri can compute them from verified data. Unverified results link to official sources — always confirm eligibility and deadlines yourself.
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

        <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-bold text-white">Personalized Funding Opportunities</h2>

            <p className="text-xs text-slate-400 mt-1">{profileSummary || 'Live scholarship matches based on your profile and chat context.'}</p>

          </div>

          {!error && (

            <div className="flex items-center gap-2 bg-[#0f0f1a] px-4 py-2.5 rounded-xl border border-white/5 text-xs font-semibold text-slate-300">

              <Award className="w-4 h-4 text-emerald-400" />

              {filteredScholarships.length} match{filteredScholarships.length !== 1 ? 'es' : ''} found

            </div>

          )}

        </div>



        {error && (

          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

            <div className="flex items-start gap-3">

              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />

              <div>

                <p className="text-sm font-semibold text-red-300">{error}</p>

                <p className="text-xs text-slate-400 mt-1">Chat with Peri to refine your profile, then try again.</p>

              </div>

            </div>

            <Link to="/chat" className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#5558DD] text-[#0f0f1a] rounded-xl text-xs font-bold transition-colors whitespace-nowrap">

              <MessageSquare className="w-4 h-4" /> Go to Chat

            </Link>

          </div>

        )}



        {!error && scholarships.length > 0 && (

          <>

            <div className="bg-[#16162a] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">

                <SlidersHorizontal className="w-4 h-4 text-[#6366F1]" /> Filter & Sort

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="space-y-1.5">

                  <label className="block text-xs text-slate-400">Target Location</label>

                  <select

                    value={countryFilter}

                    onChange={(e) => setCountryFilter(e.target.value)}

                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    {countriesList.map((c) => <option key={c} value={c}>{c}</option>)}

                  </select>

                </div>

                <div className="space-y-1.5">

                  <label className="block text-xs text-slate-400">Funding Level</label>

                  <select

                    value={fundingFilter}

                    onChange={(e) => setFundingFilter(e.target.value)}

                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    <option value="All">All Funding Types</option>

                    <option value="Fully Funded">Fully Funded Only</option>

                    <option value="Partial">Partial Support</option>

                  </select>

                </div>

                <div className="space-y-1.5">

                  <label className="block text-xs text-slate-400">Sort By</label>

                  <select

                    value={sortBy}

                    onChange={(e) => setSortBy(e.target.value)}

                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1]"

                  >

                    <option value="match">Highest Match %</option>

                    <option value="name">Name (A–Z)</option>

                  </select>

                </div>

              </div>

            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {filteredScholarships.map((item, idx) => {

                const id = item.sourceUrl || `sch-${idx}`;

                const isSaved = Boolean(savedScholarships[item.sourceUrl || id]) || isBookmarked('scholarships', item.sourceUrl);

                const matchScore = item.matchScore ?? null;
                const hasScore = matchScore != null;
                const matchColor = hasScore
                  ? (matchScore >= 80 ? '#10B981' : matchScore >= 60 ? '#F59E0B' : '#3B82F6')
                  : '#64748B';



                return (

                  <div

                    key={id}

                    className="bg-[#16162a] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 hover:border-[#6366F1]/50 transition-all flex flex-col justify-between"

                  >

                    <div className="space-y-3">

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#6366F1]/20 text-[#818cf8] mb-1.5 border border-[#6366F1]/30">

                            {item.fundingType}

                          </span>

                          <h3 className="text-base font-bold text-white leading-snug">{item.name}</h3>

                          <p className="text-xs text-slate-400 mt-1">{item.country}</p>

                          {item.verified === false && (
                            <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Unverified — check official site
                            </span>
                          )}

                        </div>

                        <button

                          type="button"

                          onClick={() => toggleSave(item, id)}

                          className={`p-2 rounded-xl border transition-all ${isSaved ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]' : 'bg-[#0f0f1a] border-white/10 text-slate-400 hover:text-white'}`}

                        >

                          <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />

                        </button>

                      </div>



                      <div className="bg-[#0f0f1a] p-3 rounded-xl border border-white/5 space-y-1.5">

                        <div className="flex justify-between items-center text-xs">

                          <span className="text-slate-400 font-medium">Profile Match</span>

                          {hasScore ? (
                            <span className="font-bold font-mono" style={{ color: matchColor }}>{matchScore}%</span>
                          ) : (
                            <span className="font-medium text-slate-500">Not scored</span>
                          )}

                        </div>

                        {hasScore && (
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${matchScore}%`, backgroundColor: matchColor }} />
                          </div>
                        )}

                      </div>



                      {item.coverage && (

                        <div className="bg-[#0f0f1a] p-3.5 rounded-xl border border-white/5 space-y-1">

                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Coverage</span>

                          <p className="text-xs text-slate-200 font-medium leading-relaxed">{item.coverage}</p>

                        </div>

                      )}



                      <p className="text-xs text-slate-300 leading-relaxed">{item.whyItFits}</p>



                      <div className="text-xs text-slate-300 space-y-1 bg-[#0f0f1a]/40 p-3 rounded-xl border border-white/5">

                        {item.eligibility && (

                          <div><span className="text-slate-400 font-medium">Eligibility:</span> {item.eligibility}</div>

                        )}

                        {item.amount && (

                          <div><span className="text-slate-400 font-medium">Amount:</span> {item.amount}</div>

                        )}

                      </div>

                    </div>



                    <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">

                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">

                        <Calendar className="w-3.5 h-3.5" />

                        <span>{item.deadline || 'Verify on official site'}</span>

                      </div>

                      {item.sourceUrl && (

                        <a

                          href={item.sourceUrl}

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



        {!error && scholarships.length === 0 && (

          <div className="text-center py-16 space-y-4">

            <Award className="w-12 h-12 text-slate-600 mx-auto" />

            <p className="text-slate-400 text-sm">No scholarship matches yet. Tell Peri about your goals in chat.</p>

            <Link to="/chat" className="inline-flex items-center gap-2 text-[#818cf8] text-sm font-semibold hover:underline">

              <MessageSquare className="w-4 h-4" /> Chat with Peri

            </Link>

          </div>

        )}

      </div>
    </div>
    </AppShell>
  );
}


