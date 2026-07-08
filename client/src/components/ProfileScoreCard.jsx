import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useChat } from '../context/ChatContext';
import { Award, AlertTriangle, Lightbulb, TrendingUp, ShieldCheck, RefreshCw } from 'lucide-react';

export default function ProfileScoreCard({ refreshTrigger }) {
  const chatContext = useChat();
  const [loading, setLoading] = useState(false);
  const [localScoreData, setLocalScoreData] = useState(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scoreData = chatContext?.profileScoreData || localScoreData;

  const fetchScore = async () => {
    if (chatContext?.fetchProfileScore) {
      setIsRefreshing(true);
      await chatContext.fetchProfileScore();
      setIsRefreshing(false);
    } else {
      if (!scoreData) setLoading(true);
      setIsRefreshing(true);
      try {
        const res = await api.get('/profile/score');
        if (res.data && res.data.data) {
          setLocalScoreData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch profile score:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchScore();
  }, [refreshTrigger]);

  // Animate score counting up / down smoothly
  useEffect(() => {
    if (scoreData?.score !== undefined) {
      const target = scoreData.score || 0;
      let start = displayScore;
      const duration = 800;
      const stepTime = 20;
      const steps = duration / stepTime;
      const increment = (target - start) / steps;
      let current = start;

      const timer = setInterval(() => {
        current += increment;
        if ((increment >= 0 && current >= target) || (increment < 0 && current <= target)) {
          setDisplayScore(target);
          clearInterval(timer);
        } else {
          setDisplayScore(Math.round(current));
        }
      }, stepTime);

      return () => clearInterval(timer);
    }
  }, [scoreData?.score]);

  if (loading && !scoreData) {
    return (
      <div className="w-full bg-[#0f0f1a] border border-white/10 rounded-2xl p-6 shadow-xl animate-pulse space-y-4 text-white">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="h-16 bg-slate-800 rounded-xl w-full"></div>
        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  if (!scoreData) return null;

  const { score = 0, admissionChance = 0, weakAreas = [], improvements = [], expectedImprovement = {} } = scoreData;

  const getScoreColor = (val) => {
    if (val < 40) return '#EF4444'; // Red
    if (val < 70) return '#F59E0B'; // Yellow
    return '#10B981'; // Green
  };

  const currentColor = getScoreColor(score);

  return (
    <div className={`w-full bg-[#0f0f1a] border rounded-2xl p-6 shadow-xl text-white font-sans space-y-6 transition-all duration-300 ${isRefreshing ? 'border-[#6366F1] shadow-[#6366F1]/20 animate-pulse' : 'border-white/10'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#6366F1]" />
          <h3 className="text-base font-bold tracking-tight text-slate-100" style={{ fontFamily: 'Inter, sans-serif' }}>
            Your Profile Score
          </h3>
        </div>
        <button
          onClick={fetchScore}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          title="Refresh Score"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#6366F1]' : ''}`} />
        </button>
      </div>

      {/* Main Score Display */}
      <div className="bg-[#16162a] rounded-xl p-5 border border-white/5 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-tight transition-all duration-300" style={{ color: currentColor }}>
              {displayScore}
            </span>
            <span className="text-sm font-semibold text-slate-400">/ 100</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border" style={{ color: currentColor, borderColor: `${currentColor}40`, backgroundColor: `${currentColor}15` }}>
            {score >= 70 ? 'Competitive' : score >= 40 ? 'Moderate' : 'Needs Work'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${Math.min(100, displayScore)}%`, backgroundColor: '#6366F1' }}
          />
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-slate-300">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#6366F1]" /> Profile Strength:
          </span>
          <span className="font-bold text-slate-100 text-sm">{admissionChance}%</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">
          Heuristic score based on your profile inputs — not a university-specific admission prediction.
        </p>
      </div>

      {/* Weak Areas */}
      {weakAreas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
            <AlertTriangle className="w-4 h-4" /> Weak Areas ({weakAreas.length})
          </div>
          <ul className="space-y-1.5 pl-1">
            {weakAreas.map((area, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-amber-400 font-bold">→</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {improvements.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <Lightbulb className="w-4 h-4 text-[#6366F1]" /> Key Improvements
          </div>
          <ul className="space-y-1.5 pl-1">
            {improvements.map((imp, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-[#6366F1] font-bold">→</span>
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expected Improvement */}
      {expectedImprovement?.afterImprovements > admissionChance && (
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Potential after improvements:
          </span>
          <span className="font-bold text-emerald-400 font-mono">
            {expectedImprovement.current}% → {expectedImprovement.afterImprovements}% strength
          </span>
        </div>
      )}
    </div>
  );
}
