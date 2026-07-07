import { Link } from 'react-router-dom';
import { User, MessageSquare } from 'lucide-react';

export default function ProfileIncompleteState({ title, description }) {
  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-sans">
      <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center">
          <User className="w-8 h-8 text-[#818cf8]" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
        <ul className="text-left text-sm text-slate-300 bg-[#1E293B] border border-white/10 rounded-2xl p-5 space-y-2">
          <li className={''}>• CGPA on your profile</li>
          <li>• Target degree (Bachelors, Masters, or PhD)</li>
          <li>• At least one preferred country</li>
        </ul>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5558e3] text-sm font-bold transition-colors"
          >
            <User className="w-4 h-4" /> Complete profile
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
          >
            <MessageSquare className="w-4 h-4" /> Chat with Peri
          </Link>
        </div>
      </div>
    </div>
  );
}
