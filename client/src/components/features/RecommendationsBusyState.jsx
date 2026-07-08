import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import AiBusyBanner from './AiBusyBanner';

function SkeletonCard() {
  return (
    <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 space-y-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-700/60 rounded w-3/4" />
          <div className="h-3 bg-slate-700/40 rounded w-1/2" />
        </div>
        <div className="h-8 w-8 bg-slate-700/40 rounded-xl flex-shrink-0" />
      </div>
      <div className="h-12 bg-[#0f0f1a] rounded-xl border border-white/5" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-700/40 rounded w-full" />
        <div className="h-3 bg-slate-700/40 rounded w-5/6" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-10 bg-[#0f0f1a]/60 rounded-lg border border-white/5" />
        <div className="h-10 bg-[#0f0f1a]/60 rounded-lg border border-white/5" />
      </div>
    </div>
  );
}

export default function RecommendationsBusyState({
  title,
  icon: Icon,
  iconClassName = 'text-[#6366F1]',
  currentTask,
  itemLabel = 'recommendations',
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white font-sans">
      <header className="sticky top-0 z-20 bg-[#16162a]/90 backdrop-blur border-b border-white/10 px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#6366F1]" /> Back to Chat
        </button>
        <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          {Icon && <Icon className={`w-5 h-5 ${iconClassName}`} />}
          {title}
        </h1>
        <div className="w-20" />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <AiBusyBanner
          currentTask={currentTask}
          className="w-full text-sm py-4 px-5 rounded-2xl"
        />

        <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 text-center space-y-3">
          <p className="text-base font-semibold text-white">Come back when Peri is free</p>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Peri can only run one AI task at a time. Your {itemLabel} will load automatically once the current task finishes — or you can check progress in chat.
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366F1] hover:bg-[#5558DD] text-[#0f0f1a] rounded-xl text-sm font-bold transition-colors"
          >
            <MessageSquare className="w-4 h-4" /> Go to Chat
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
