import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useChat } from '../context/ChatContext';
import InteractiveMascot from '../components/mascot/InteractiveMascot';
import { ArrowRight, Shield, Sparkles } from 'lucide-react';

const DEGREES = ['Bachelors', 'Masters', 'PhD'];
const COUNTRIES = [
  'Canada', 'Germany', 'United Kingdom', 'United States', 'Australia',
  'Netherlands', 'Sweden', 'Malaysia', 'Turkey', 'United Arab Emirates',
];

export default function OnboardingWizard({ onComplete }) {
  const { updateProfile } = useProfile();
  const { createSession, sessions } = useChat();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    targetDegree: '',
    preferredCountry: '',
    gpa: '',
  });

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    const gpaNum = parseFloat(form.gpa);
    if (!form.name.trim() || !form.targetDegree || !form.preferredCountry || Number.isNaN(gpaNum)) {
      setError('Please fill in all fields.');
      setSaving(false);
      return;
    }

    const result = await updateProfile({
      name: form.name.trim(),
      targetDegree: form.targetDegree,
      preferredCountries: [form.preferredCountry],
      gpa: gpaNum,
    });

    if (!result.success) {
      setError(result.message || 'Could not save profile.');
      setSaving(false);
      return;
    }

    if (sessions.length === 0) {
      try {
        await createSession();
      } catch {
        /* non-fatal */
      }
    }

    onComplete?.();
    navigate('/chat');
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-[#1e293b] p-8 shadow-xl">
        <div className="flex justify-center mb-4">
          <InteractiveMascot size={120} interactive={false} />
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${n === step ? 'w-8 bg-[#39B1D1]' : n < step ? 'w-4 bg-[#39B1D1]/50' : 'w-4 bg-white/10'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-2xl font-bold text-center">Welcome to AskPeri</h1>
            <p className="text-slate-300 text-sm leading-relaxed text-center">
              Everything runs on your machine. Conversations stay local.
            </p>
            <div className="rounded-xl bg-[#0f172a]/60 border border-white/10 p-4 space-y-3 text-sm text-slate-300">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-[#39B1D1] flex-shrink-0 mt-0.5" />
                <p>Your chat history and profile are stored in a local SQLite database — no cloud account required.</p>
              </div>
              <div className="flex gap-3">
                <Sparkles className="w-5 h-5 text-[#D6FB61] flex-shrink-0 mt-0.5" />
                <p>Web search sends generalized queries only. Add an optional Tavily API key in Settings for richer results.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-[#39B1D1] hover:bg-[#2da0bf] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold">Tell Peri about yourself</h2>
            <p className="text-slate-400 text-sm">These basics help personalize universities, scholarships, and your roadmap.</p>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Your name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ayesha"
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#39B1D1]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Target degree</span>
              <select
                value={form.targetDegree}
                onChange={(e) => setForm((f) => ({ ...f, targetDegree: e.target.value }))}
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#39B1D1]"
              >
                <option value="">Select degree</option>
                {DEGREES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Preferred country</span>
              <select
                value={form.preferredCountry}
                onChange={(e) => setForm((f) => ({ ...f, preferredCountry: e.target.value }))}
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#39B1D1]"
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">CGPA (0.00 – 4.00)</span>
              <input
                type="number"
                min="0"
                max="4"
                step="0.01"
                value={form.gpa}
                onChange={(e) => setForm((f) => ({ ...f, gpa: e.target.value }))}
                placeholder="e.g. 3.2"
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#39B1D1]"
              />
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 font-semibold transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  const gpaNum = parseFloat(form.gpa);
                  if (!form.name.trim() || !form.targetDegree || !form.preferredCountry || Number.isNaN(gpaNum)) {
                    setError('Please fill in all fields.');
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
                className="flex-1 py-3 rounded-xl bg-[#39B1D1] hover:bg-[#2da0bf] font-semibold transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-fade-in text-center">
            <h2 className="text-xl font-bold">You&apos;re all set!</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Peri will use your profile to suggest universities, scholarships, and a step-by-step roadmap.
              You can refine details anytime in chat or on your profile page.
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5558e3] disabled:opacity-50 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : 'Start chatting'}
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
