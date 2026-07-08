import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useChat } from '../context/ChatContext';
import InteractiveMascot from '../components/mascot/InteractiveMascot';
import { ArrowRight, Shield, Sparkles } from 'lucide-react';
import { EDUCATION_PATHWAYS } from '../constants/educationLevels';
import { percentToCgpa, cgpaToPercent } from '../utils/gpaConversion';

const DEGREES = ['Bachelors', 'Masters', 'PhD'];
const COUNTRIES = [
  'Canada', 'Germany', 'United Kingdom', 'United States', 'Australia',
  'Netherlands', 'Sweden', 'Malaysia', 'Turkey', 'United Arab Emirates',
];

function validateStep2(form) {
  if (!form.name.trim()) return 'Please enter your name.';
  if (!form.targetDegree) return 'Please select your target degree.';
  if (!form.preferredCountry) return 'Please select a preferred country.';
  if (!form.pathway) return 'Please select your education pathway (FSc, A-Levels, or other).';
  const gpaNum = parseFloat(String(form.gpa).replace(',', '.'));
  if (form.gpa === '' || Number.isNaN(gpaNum)) return 'Please enter your CGPA or percentage.';
  if (gpaNum < 0 || gpaNum > 4) return 'CGPA must be between 0.00 and 4.00.';
  return null;
}

export default function OnboardingWizard({ onComplete }) {
  const { updateProfile } = useProfile();
  const { createSession, sessions } = useChat();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [gpaInputMode, setGpaInputMode] = useState('cgpa');
  const [percentInput, setPercentInput] = useState('');
  const [form, setForm] = useState({
    name: '',
    targetDegree: '',
    preferredCountry: '',
    pathway: '',
    gpa: '',
  });

  const percentPreview = useMemo(() => {
    if (gpaInputMode !== 'cgpa' || !form.gpa) return null;
    return cgpaToPercent(form.gpa);
  }, [gpaInputMode, form.gpa]);

  const handlePercentChange = (raw) => {
    setPercentInput(raw);
    const cgpa = percentToCgpa(raw);
    setForm((f) => ({ ...f, gpa: cgpa != null ? String(cgpa) : '' }));
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    const validationError = validateStep2(form);
    if (validationError) {
      setError(validationError);
      setSaving(false);
      return;
    }

    const gpaNum = parseFloat(String(form.gpa).replace(',', '.'));
    const educationLevel = form.pathway === 'other' ? 'Undergraduate' : 'FSc / A-Levels';

    const result = await updateProfile({
      name: form.name.trim(),
      targetDegree: form.targetDegree,
      preferredCountries: [form.preferredCountry],
      educationLevel,
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
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] text-white p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-[#16162a] p-8 shadow-xl">
        <div className="flex justify-center mb-4">
          <InteractiveMascot size={120} interactive={false} />
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${n === step ? 'w-8 bg-[#6366F1]' : n < step ? 'w-4 bg-[#6366F1]/50' : 'w-4 bg-white/10'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-2xl font-bold text-center">Welcome to AskPeri</h1>
            <p className="text-slate-300 text-sm leading-relaxed text-center">
              Everything runs on your machine. Conversations stay local.
            </p>
            <div className="rounded-xl bg-[#0f0f1a]/60 border border-white/10 p-4 space-y-3 text-sm text-slate-300">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-[#6366F1] flex-shrink-0 mt-0.5" />
                <p>Your chat history and profile are stored in a local SQLite database — no cloud account required.</p>
              </div>
              <div className="flex gap-3">
                <Sparkles className="w-5 h-5 text-[#2DD4BF] flex-shrink-0 mt-0.5" />
                <p>Web search sends generalized queries only. Add an optional Tavily API key in Settings for richer results.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5558DD] text-[#0f0f1a] font-semibold transition-colors flex items-center justify-center gap-2"
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
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366F1]"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-400">Education pathway</legend>
              <div className="flex flex-wrap gap-2">
                {EDUCATION_PATHWAYS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={form.pathway === p.id}
                    onClick={() => setForm((f) => ({ ...f, pathway: p.id }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      form.pathway === p.id
                        ? 'bg-[#6366F1] text-[#0f0f1a] border-[#6366F1]'
                        : 'bg-[#0f0f1a] text-slate-300 border-white/10 hover:border-[#6366F1]/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Target degree</span>
              <select
                value={form.targetDegree}
                onChange={(e) => setForm((f) => ({ ...f, targetDegree: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366F1]"
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
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366F1]"
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Academic score</span>
                <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px] font-bold">
                  <button
                    type="button"
                    aria-pressed={gpaInputMode === 'cgpa'}
                    onClick={() => setGpaInputMode('cgpa')}
                    className={`px-2.5 py-1 ${gpaInputMode === 'cgpa' ? 'bg-[#6366F1] text-[#0f0f1a]' : 'bg-[#0f0f1a] text-slate-400'}`}
                  >
                    CGPA (4.0)
                  </button>
                  <button
                    type="button"
                    aria-pressed={gpaInputMode === 'percent'}
                    onClick={() => setGpaInputMode('percent')}
                    className={`px-2.5 py-1 ${gpaInputMode === 'percent' ? 'bg-[#6366F1] text-[#0f0f1a]' : 'bg-[#0f0f1a] text-slate-400'}`}
                  >
                    % Marks
                  </button>
                </div>
              </div>

              {gpaInputMode === 'cgpa' ? (
                <>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    value={form.gpa}
                    onChange={(e) => setForm((f) => ({ ...f, gpa: e.target.value }))}
                    placeholder="e.g. 3.2"
                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366F1]"
                  />
                  {percentPreview != null && (
                    <p className="text-[11px] text-slate-400">
                      ≈ {percentPreview}% on Pakistani scale (CGPA × 25)
                    </p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={percentInput}
                    onChange={(e) => handlePercentChange(e.target.value)}
                    placeholder="e.g. 80"
                    className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366F1]"
                  />
                  {form.gpa && (
                    <p className="text-[11px] text-slate-400">
                      ≈ {form.gpa} CGPA (percentage ÷ 25)
                    </p>
                  )}
                </>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setError(null); setStep(1); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 font-semibold transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  const validationError = validateStep2(form);
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
                className="flex-1 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5558DD] text-[#0f0f1a] font-semibold transition-colors"
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
              className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5558DD] disabled:opacity-50 text-[#0f0f1a] font-semibold transition-colors flex items-center justify-center gap-2"
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
