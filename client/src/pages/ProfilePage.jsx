import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useChat } from '../context/ChatContext';
import api from '../services/api';
import MascotLoader from '../components/mascot/MascotLoader';
import {
  ArrowLeft, User, Mail, Calendar, Award, CheckCircle2,
  Globe, BookOpen, GraduationCap, DollarSign, Briefcase,
  FlaskConical, FileText, Save, Loader2, X, Search, ChevronDown,
  AlertTriangle, Info, AlertCircle, RefreshCw, Square, CheckSquare, Settings
} from 'lucide-react';

const PKR_TO_USD = 280;
const AVATARS = ['default-pfp.png', 'pfp1.png', 'pfp2.png', 'pfp3.png'];

const ALL_COUNTRIES = [
  'Australia', 'Austria', 'Belgium', 'Canada', 'China', 'Czech Republic', 'Denmark',
  'Finland', 'France', 'Germany', 'Hungary', 'Ireland', 'Italy', 'Japan', 'Malaysia',
  'Netherlands', 'New Zealand', 'Norway', 'Pakistan', 'Poland', 'Portugal', 'Qatar',
  'Saudi Arabia', 'Singapore', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Turkey', 'United Arab Emirates', 'United Kingdom', 'United States'
];

const formatPkr = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const clean = String(val).replace(/,/g, '').trim();
  if (isNaN(clean) || clean === '') return val;
  return Number(clean).toLocaleString('en-US');
};

const parsePkrNumber = (str) => {
  if (!str) return 0;
  const lacMatch = String(str).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(lac|lakh)/);
  if (lacMatch) {
    return Math.round(Number(lacMatch[1]) * 100000);
  }
  const clean = String(str).replace(/,/g, '').trim();
  return isNaN(clean) ? 0 : Number(clean);
};

const mapWorkExpToDropdown = (years) => {
  if (years === null || years === undefined) return '';
  if (years === 0) return '0';
  if (years <= 0.5) return '0.5';
  if (years <= 1) return '1';
  if (years <= 2) return '2';
  if (years <= 3) return '3';
  if (years <= 4) return '4';
  return '5';
};

function CountryDropdown({ selected, onSelect, onRemove, error }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const filtered = ALL_COUNTRIES.filter(c =>
    c.toLowerCase().includes(search.toLowerCase()) && !selected.includes(c)
  );

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isMax = selected.length >= 10;

  return (
    <div ref={ref} className="relative" id="field-preferredCountries">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.map(c => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#6366F1]/20 text-[#818cf8] border border-[#6366F1]/30"
            >
              <Globe className="w-3 h-3" />
              {c}
              <button
                type="button"
                onClick={() => onRemove(c)}
                className="ml-1 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => !isMax && setOpen(o => !o)}
        disabled={isMax}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-slate-300 transition-colors ${error ? 'border-red-500' : 'border-white/10 hover:border-[#6366F1]/50'}`}
      >
        <span className="text-slate-400">
          {isMax ? 'Maximum 10 countries selected' : 'Add preferred target country...'}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && !isMax && (
        <div className="absolute z-30 mt-2 w-full bg-[#1E293B] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/10 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 ml-2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full bg-transparent border-none text-sm text-white focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 text-center">No matching countries</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onSelect(c); setSearch(''); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-[#6366F1]/20 hover:text-white rounded-lg transition-colors flex items-center justify-between"
                >
                  <span>{c}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{error}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, fetchProfile, setUser } = useProfile();
  const { lastScoreUpdated } = useChat();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showZeroBudgetModal, setShowZeroBudgetModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);
  const [checkedImprovements, setCheckedImprovements] = useState({});
  const [errors, setErrors] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    gpa: '',
    educationLevel: 'Undergraduate',
    targetDegree: 'Masters',
    major: '',
    preferredCountries: [],
    budgetPkr: '',
    englishTestType: 'None',
    englishTestScore: '',
    workExperience: '0',
    researchExperience: false,
    publications: '0',
    age: '',
    avatar: 'default-pfp.png'
  });

  const applyProfileResponse = (u, bd) => {
    setBreakdownData(bd);
    setUser(u);

    const p = u.profile || {};
    const et = p.englishTest || {};
    const usdBudget = p.maxBudget !== null && p.maxBudget !== undefined ? p.maxBudget : '';
    const pkrVal = usdBudget !== '' ? Math.round(Number(usdBudget) * PKR_TO_USD) : '';

    setFormData({
      name: u.name || '',
      gpa: p.gpa !== null && p.gpa !== undefined ? String(p.gpa) : '',
      educationLevel: p.educationLevel || 'Undergraduate',
      targetDegree: p.targetDegree || 'Masters',
      major: p.major || '',
      preferredCountries: p.preferredCountries || [],
      budgetPkr: pkrVal !== '' ? formatPkr(pkrVal) : '',
      englishTestType: et.testType || 'None',
      englishTestScore: et.score !== null && et.score !== undefined ? String(et.score) : '',
      workExperience: mapWorkExpToDropdown(p.workExperience),
      researchExperience: Boolean(p.researchExperience),
      publications: String(p.publications !== undefined ? p.publications : 0),
      age: p.age !== null && p.age !== undefined ? String(p.age) : '',
      avatar: p.avatar || 'default-pfp.png'
    });
  };

  const loadProfileData = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const res = await api.get('/profile');
      if (res.data && res.data.data) {
        applyProfileResponse(res.data.data.user, res.data.data.breakdown);
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData({ showLoader: true });

    const handleFocus = () => {
      loadProfileData({ showLoader: false });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const prevScoreUpdated = useRef(null);
  useEffect(() => {
    if (prevScoreUpdated.current !== null && prevScoreUpdated.current !== lastScoreUpdated) {
      loadProfileData({ showLoader: false });
    }
    prevScoreUpdated.current = lastScoreUpdated;
  }, [lastScoreUpdated]);

  // Auto-save draft to localStorage every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty) {
        localStorage.setItem('askperi_profile_draft', JSON.stringify(formData));
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData, isDirty]);

  // Unsaved changes browser prompt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const updateField = (field, value) => {
    setIsDirty(true);
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      
      // Edge Case 8: Publications > 0 auto sets researchExperience = true
      if (field === 'publications' && parsePkrNumber(value) > 0) {
        next.researchExperience = true;
      }
      
      validateField(field, value, next);
      return next;
    });
  };

  const validateField = (field, val, state = formData) => {
    const errs = { ...errors };

    if (field === 'name') {
      const str = String(val).trim();
      if (str.length < 2 || str.length > 50 || !/^[a-zA-Z\s-]+$/.test(str)) {
        errs.name = "Name must be 2-50 characters, letters only";
      } else {
        delete errs.name;
      }
    }

    if (field === 'gpa') {
      let cleanVal = String(val).replace(',', '.').trim(); // Edge case 1: comma to dot
      if (cleanVal !== '') {
        const num = Number(cleanVal);
        if (isNaN(num) || num < 0 || num > 4.0) {
          errs.gpa = "GPA must be between 0.00 and 4.00";
        } else {
          delete errs.gpa;
        }
      } else {
        delete errs.gpa;
      }
    }

    if (field === 'educationLevel' || field === 'targetDegree') {
      const currentEdu = field === 'educationLevel' ? val : state.educationLevel;
      const targetDeg = field === 'targetDegree' ? val : state.targetDegree;
      if (currentEdu === 'Postgraduate' && targetDeg === 'Bachelors') {
        errs.targetDegree = "Target degree cannot be lower than current level";
      } else {
        delete errs.targetDegree;
      }
    }

    if (field === 'major') {
      const str = String(val).trim();
      if (str !== '' && (str.length < 2 || str.length > 100 || /^\d/.test(str))) {
        errs.major = "Please enter a valid field of study";
      } else {
        delete errs.major;
      }
    }

    if (field === 'budgetPkr') {
      const pkrNum = parsePkrNumber(val);
      if (val !== '' && (isNaN(pkrNum) || pkrNum < 0)) {
        errs.budgetPkr = "Budget cannot be negative";
      } else if (pkrNum > 280000000) {
        errs.budgetPkr = "Budget cannot exceed 280,000,000 PKR";
      } else {
        delete errs.budgetPkr;
      }
    }

    if (field === 'englishTestScore' || field === 'englishTestType') {
      const type = field === 'englishTestType' ? val : state.englishTestType;
      const scoreStr = field === 'englishTestScore' ? val : state.englishTestScore;
      if (type !== 'None' && scoreStr !== '') {
        const scoreNum = Number(scoreStr);
        if (isNaN(scoreNum)) {
          errs.englishTestScore = "Please enter a valid score";
        } else if (type === 'IELTS' && (scoreNum < 0 || scoreNum > 9)) {
          errs.englishTestScore = "IELTS score must be between 0.0 and 9.0";
        } else if (type === 'TOEFL' && (scoreNum < 0 || scoreNum > 120 || !Number.isInteger(scoreNum))) {
          errs.englishTestScore = "TOEFL score must be between 0 and 120";
        } else if (type === 'Duolingo' && (scoreNum < 10 || scoreNum > 160 || !Number.isInteger(scoreNum))) {
          errs.englishTestScore = "Duolingo score must be between 10 and 160";
        } else {
          delete errs.englishTestScore;
        }
      } else {
        delete errs.englishTestScore;
      }
    }

    if (field === 'publications') {
      if (val !== '') {
        const num = Number(val);
        if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(num)) {
          errs.publications = "Publications must be a number between 0 and 100";
        } else {
          delete errs.publications;
        }
      } else {
        delete errs.publications;
      }
    }

    if (field === 'age') {
      if (val !== '') {
        const num = Number(val);
        if (isNaN(num) || num < 17 || num > 45 || !Number.isInteger(num)) {
          errs.age = "Age must be between 17 and 45";
        } else {
          delete errs.age;
        }
      } else {
        delete errs.age;
      }
    }

    setErrors(errs);
  };

  const handleCountrySelect = (country) => {
    if (formData.preferredCountries.length < 10) {
      updateField('preferredCountries', [...formData.preferredCountries, country]);
    } else {
      setErrors(prev => ({ ...prev, preferredCountries: "Maximum 10 countries reached" }));
    }
  };

  const handleCountryRemove = (country) => {
    updateField('preferredCountries', formData.preferredCountries.filter(c => c !== country));
  };

  const validateAll = () => {
    const errs = {};
    const strName = formData.name.trim();
    if (strName.length < 2 || strName.length > 50 || !/^[a-zA-Z\s-]+$/.test(strName)) {
      errs.name = "Name must be 2-50 characters, letters only";
    }

    const cleanGpa = formData.gpa.replace(',', '.').trim();
    if (cleanGpa !== '') {
      const num = Number(cleanGpa);
      if (isNaN(num) || num < 0 || num > 4.0) errs.gpa = "GPA must be between 0.00 and 4.00";
    }

    if (formData.educationLevel === 'Postgraduate' && formData.targetDegree === 'Bachelors') {
      errs.targetDegree = "Target degree cannot be lower than current level";
    }

    const strMajor = formData.major.trim();
    if (strMajor !== '' && (strMajor.length < 2 || strMajor.length > 100 || /^\d/.test(strMajor))) {
      errs.major = "Please enter a valid field of study";
    }

    const pkrNum = parsePkrNumber(formData.budgetPkr);
    if (formData.budgetPkr !== '' && (isNaN(pkrNum) || pkrNum < 0)) {
      errs.budgetPkr = "Budget cannot be negative";
    }

    if (formData.englishTestType !== 'None' && formData.englishTestScore !== '') {
      const sNum = Number(formData.englishTestScore);
      if (isNaN(sNum)) errs.englishTestScore = "Please enter a valid score";
      else if (formData.englishTestType === 'IELTS' && (sNum < 0 || sNum > 9)) errs.englishTestScore = "IELTS score must be between 0.0 and 9.0";
      else if (formData.englishTestType === 'TOEFL' && (sNum < 0 || sNum > 120 || !Number.isInteger(sNum))) errs.englishTestScore = "TOEFL score must be between 0 and 120";
      else if (formData.englishTestType === 'Duolingo' && (sNum < 10 || sNum > 160 || !Number.isInteger(sNum))) errs.englishTestScore = "Duolingo score must be between 10 and 160";
    }

    if (formData.publications !== '') {
      const pNum = Number(formData.publications);
      if (isNaN(pNum) || pNum < 0 || pNum > 100 || !Number.isInteger(pNum)) errs.publications = "Publications must be a number between 0 and 100";
    }

    if (formData.age !== '') {
      const aNum = Number(formData.age);
      if (isNaN(aNum) || aNum < 17 || aNum > 45 || !Number.isInteger(aNum)) errs.age = "Age must be between 17 and 45";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const executeSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const pkrVal = parsePkrNumber(formData.budgetPkr);
      const computedUsd = Math.round((pkrVal / PKR_TO_USD) * 100) / 100;
      const cleanGpa = formData.gpa ? Number(formData.gpa.replace(',', '.').trim()) : null;

      const payload = {
        name: formData.name.trim(),
        gpa: cleanGpa,
        educationLevel: formData.educationLevel,
        targetDegree: formData.targetDegree,
        major: formData.major.trim(),
        preferredCountries: formData.preferredCountries,
        budgetInPkr: pkrVal,
        budgetCurrency: 'PKR',
        maxBudget: computedUsd,
        englishTest: {
          testType: formData.englishTestType,
          score: formData.englishTestType !== 'None' && formData.englishTestScore !== '' ? Number(formData.englishTestScore) : null
        },
        workExperience: Number(formData.workExperience || 0),
        researchExperience: Boolean(formData.researchExperience),
        publications: Boolean(formData.researchExperience) ? Number(formData.publications || 0) : 0,
        age: formData.age !== '' ? Number(formData.age) : null,
        avatar: formData.avatar
      };

      const res = await api.put('/profile', payload);
      if (res.data && res.data.data) {
        setBreakdownData(res.data.data.breakdown);
      }

      if (fetchProfile) await fetchProfile({ silent: true });

      setIsDirty(false);
      localStorage.removeItem('askperi_profile_draft');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
        const firstErrKey = Object.keys(err.response.data.errors)[0];
        document.getElementById(`field-${firstErrKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setSaveError(err.response?.data?.message || "Failed to save profile. Try again.");
    } finally {
      setSaving(false);
      setShowZeroBudgetModal(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateAll()) {
      const firstErrKey = Object.keys(errors)[0];
      document.getElementById(`field-${firstErrKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Edge Case 3: Zero budget confirmation modal
    const pkrVal = parsePkrNumber(formData.budgetPkr);
    if (pkrVal === 0) {
      setShowZeroBudgetModal(true);
    } else {
      executeSave();
    }
  };

  // Task 5: Profile Completeness Indicator
  const calculateCompleteness = () => {
    let count = 0;
    if (formData.gpa !== '' && formData.gpa !== null) count++;
    if (formData.educationLevel) count++;
    if (formData.targetDegree) count++;
    if (formData.major) count++;
    if (formData.preferredCountries.length > 0) count++;
    if (formData.budgetPkr !== '' && formData.budgetPkr !== null) count++;
    if (formData.englishTestType !== 'None') count++;
    if (formData.workExperience !== undefined && formData.workExperience !== null) count++;
    if (formData.researchExperience !== null && formData.researchExperience !== undefined) count++;
    if (formData.age !== '' && formData.age !== null) count++;
    return count;
  };

  const completenessCount = calculateCompleteness();
  const completenessPct = completenessCount * 10;
  const completenessColor = completenessPct >= 70 ? '#10B981' : completenessPct >= 40 ? '#F59E0B' : '#EF4444';

  const scrollToIncomplete = () => {
    const checks = [
      { field: 'gpa', filled: formData.gpa !== '' },
      { field: 'educationLevel', filled: !!formData.educationLevel },
      { field: 'targetDegree', filled: !!formData.targetDegree },
      { field: 'major', filled: !!formData.major },
      { field: 'preferredCountries', filled: formData.preferredCountries.length > 0 },
      { field: 'budgetPkr', filled: formData.budgetPkr !== '' },
      { field: 'englishTestType', filled: formData.englishTestType !== 'None' },
      { field: 'age', filled: formData.age !== '' }
    ];
    const firstMissing = checks.find(c => !c.filled);
    if (firstMissing) {
      document.getElementById(`field-${firstMissing.field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) return <MascotLoader message="Loading your profile..." />;

  const score = breakdownData?.score || 0;
  const chance = breakdownData?.admissionChance || 0;
  const breakdown = breakdownData?.breakdown || {};
  const scoreColor = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';

  const liveUsdEquivalent = Math.round(parsePkrNumber(formData.budgetPkr) / PKR_TO_USD);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-sans">
      {/* Zero Budget Confirmation Modal */}
      {showZeroBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">Fully Funded Scholarship Mode</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Setting your budget to <strong>0 PKR</strong> means you are exclusively looking for fully-funded scholarships covering 100% of tuition and living expenses.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowZeroBudgetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancel & Change
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="px-4 py-2 rounded-xl bg-[#6366F1] text-white hover:bg-[#4f46e5] text-xs font-bold shadow-lg"
              >
                Proceed & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-20 bg-[#1E293B]/90 backdrop-blur border-b border-white/10 px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#6366F1]" /> Back to Chat
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-tight text-white">Student Profile</h1>
          {isDirty && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Unsaved Changes
            </span>
          )}
        </div>
        <div className="w-20 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* TASK 5: PROFILE COMPLETENESS INDICATOR */}
        <div
          onClick={scrollToIncomplete}
          className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 shadow-xl cursor-pointer hover:border-[#6366F1]/50 transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300">
              Profile Completeness: <span className="text-white font-mono">{completenessCount}/10 fields filled</span>
            </span>
            <span className="font-mono" style={{ color: completenessColor }}>{completenessPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${completenessPct}%`, backgroundColor: completenessColor }}
            />
          </div>
        </div>

        {/* SECTION 1: PROFILE HEADER */}
        <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#6366F1] bg-slate-800 flex-shrink-0 shadow-lg">
              <img
                src={`/${formData.avatar}`}
                alt={formData.name || user?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">{formData.name || user?.name}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#6366F1]" /> {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-[#0F172A]/80 border border-white/5 rounded-2xl p-4 md:px-6">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="#1E293B" strokeWidth="6" fill="transparent" />
                  <circle
                    cx="40" cy="40" r="34"
                    stroke={scoreColor} strokeWidth="6" fill="transparent"
                    strokeDasharray={213}
                    strokeDashoffset={213 - (213 * score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <span className="absolute text-xl font-extrabold" style={{ color: scoreColor }}>{score}</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Profile Score</p>
            </div>

            <div className="space-y-2 text-left border-l border-white/10 pl-5">
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full border" style={{ color: scoreColor, borderColor: `${scoreColor}40`, backgroundColor: `${scoreColor}15` }}>
                {chance}% Profile Strength
              </span>
              <p className="text-xs text-slate-400 max-w-[140px]">
                Heuristic score from your inputs — not a university-specific admission prediction.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: SCORE BREAKDOWN PANEL */}
        <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <Award className="w-5 h-5 text-[#6366F1]" />
            <h3 className="text-lg font-bold text-white">Score Breakdown Panel</h3>
          </div>

          <div className="space-y-5">
            {[
              { label: 'GPA Score', data: breakdown.gpa, icon: <GraduationCap className="w-4 h-4 text-indigo-400" /> },
              { label: 'English Test', data: breakdown.englishTest, icon: <BookOpen className="w-4 h-4 text-sky-400" /> },
              { label: 'Work Experience', data: breakdown.experience, icon: <Briefcase className="w-4 h-4 text-amber-400" /> },
              { label: 'Research & Publications', data: breakdown.research, icon: <FlaskConical className="w-4 h-4 text-emerald-400" /> },
              { label: 'Financial Budget', data: breakdown.budget, icon: <DollarSign className="w-4 h-4 text-purple-400" /> }
            ].map((cat, idx) => {
              const catScore = cat.data?.score || 0;
              const catMax = cat.data?.max || 100;
              const pct = Math.min(100, (catScore / catMax) * 100);

              return (
                <div key={idx} className="space-y-1.5 bg-[#0F172A]/50 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200 flex items-center gap-2">
                      {cat.icon} {cat.label}
                    </span>
                    <span className="font-mono font-bold text-slate-300">
                      {catScore} / {catMax} pts
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6366F1] rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 pt-0.5">{cat.data?.feedback}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: EDIT PROFILE FORM */}
        <form onSubmit={handleSubmit} className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#6366F1]" />
              <h3 className="text-lg font-bold text-white">Edit Profile Attributes</h3>
            </div>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Profile updated! Score recalculated.
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" /> {saveError}
                </span>
              )}
            </div>
          </div>

          {/* Avatar Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Choose Avatar</label>
            <div className="flex gap-4">
              {AVATARS.map(img => (
                <button
                  key={img}
                  type="button"
                  onClick={() => updateField('avatar', img)}
                  className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all p-0.5 bg-slate-800 ${formData.avatar === img ? 'border-[#6366F1] scale-105 shadow-lg shadow-[#6366F1]/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={`/${img}`} alt="Avatar option" className="w-full h-full object-cover rounded-full" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Full Name */}
            <div className="space-y-1.5" id="field-name">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.name ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
                required
              />
              {errors.name && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.name}</p>}
            </div>

            {/* CGPA */}
            <div className="space-y-1.5" id="field-gpa">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">CGPA (0.0 - 4.0)</label>
              <input
                type="text"
                value={formData.gpa}
                onChange={e => updateField('gpa', e.target.value)}
                placeholder="e.g. 3.50"
                className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.gpa ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
              />
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Info className="w-3 h-3 text-sky-400 flex-shrink-0" /> Enter on 4.0 scale. Pakistani percentage? Divide by 25
              </p>
              {errors.gpa && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.gpa}</p>}
            </div>

            {/* Education Level */}
            <div className="space-y-1.5" id="field-educationLevel">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Current Education Level</label>
              <select
                value={formData.educationLevel}
                onChange={e => updateField('educationLevel', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F172A] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#6366F1]"
              >
                <option value="High School">High School</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
            </div>

            {/* Target Degree */}
            <div className="space-y-1.5" id="field-targetDegree">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Target Degree</label>
              <select
                value={formData.targetDegree}
                onChange={e => updateField('targetDegree', e.target.value)}
                className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.targetDegree ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
              >
                <option value="Bachelors">Bachelors</option>
                <option value="Masters">Masters</option>
                <option value="PhD">PhD</option>
              </select>
              {errors.targetDegree && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.targetDegree}</p>}
            </div>

            {/* Major */}
            <div className="space-y-1.5" id="field-major">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Field of Study / Major</label>
              <input
                type="text"
                value={formData.major}
                onChange={e => updateField('major', e.target.value)}
                placeholder="e.g. Computer Science"
                className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.major ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
              />
              {errors.major && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.major}</p>}
            </div>

            {/* Age */}
            <div className="space-y-1.5" id="field-age">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Age</label>
              <input
                type="number"
                value={formData.age}
                onChange={e => updateField('age', e.target.value)}
                placeholder="e.g. 22"
                className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.age ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
              />
              {/* Edge Case 6 Warning */}
              {formData.age === '17' && formData.educationLevel === 'Postgraduate' && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> This combination seems unusual. Please verify your details.
                </p>
              )}
              {errors.age && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.age}</p>}
            </div>
          </div>

          {/* TASK 2: REAL-TIME BUDGET PKR DISPLAY & PRESETS */}
          <div className="space-y-2 pt-2" id="field-budgetPkr">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Annual Budget (PKR)</label>
            <div className="relative">
              <input
                type="text"
                value={formData.budgetPkr}
                onChange={e => updateField('budgetPkr', formatPkr(e.target.value))}
                placeholder="e.g. 1,400,000"
                className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.budgetPkr ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
              />
            </div>

            {/* Live USD Equivalent & Helper */}
            <div className="flex flex-wrap items-center justify-between text-xs gap-2 pt-0.5">
              <span className="font-mono font-semibold text-[#818cf8]">
                ≈ ${liveUsdEquivalent.toLocaleString()} USD
              </span>
              <span className="text-slate-400">
                0 PKR = Fully funded scholarships only
              </span>
            </div>

            {/* Presets Quick-Select Row */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: 'Fully Funded', val: '0' },
                { label: 'Under 5 Lac', val: '500,000' },
                { label: 'Under 10 Lac', val: '1,000,000' },
                { label: 'Under 20 Lac', val: '2,000,000' }
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updateField('budgetPkr', preset.val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F172A] border border-white/10 hover:border-[#6366F1]/50 text-slate-300 hover:text-white transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {errors.budgetPkr && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.budgetPkr}</p>}
          </div>

          {/* Preferred Countries */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Preferred Target Countries</label>
            <CountryDropdown
              selected={formData.preferredCountries}
              onSelect={handleCountrySelect}
              onRemove={handleCountryRemove}
              error={errors.preferredCountries}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* English Test Type */}
            <div className="space-y-1.5" id="field-englishTestType">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">English Language Test</label>
              <select
                value={formData.englishTestType}
                onChange={e => updateField('englishTestType', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F172A] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#6366F1]"
              >
                <option value="None">None / Not Taken Yet</option>
                <option value="IELTS">IELTS</option>
                <option value="TOEFL">TOEFL</option>
                <option value="Duolingo">Duolingo</option>
              </select>
            </div>

            {/* English Score */}
            {formData.englishTestType !== 'None' && (
              <div className="space-y-1.5" id="field-englishTestScore">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  {formData.englishTestType} Overall Score
                </label>
                <input
                  type="number"
                  step={formData.englishTestType === 'IELTS' ? "0.5" : "1"}
                  value={formData.englishTestScore}
                  onChange={e => updateField('englishTestScore', e.target.value)}
                  placeholder={formData.englishTestType === 'IELTS' ? 'e.g. 7.0' : 'e.g. 95'}
                  className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.englishTestScore ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
                />
                {/* Edge Case 4 Warning */}
                {formData.englishTestScore === '' && (
                  <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" /> Add your {formData.englishTestType} score to improve your profile score
                  </p>
                )}
                {errors.englishTestScore && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.englishTestScore}</p>}
              </div>
            )}

            {/* Work Experience */}
            <div className="space-y-1.5" id="field-workExperience">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Work Experience</label>
              <select
                value={formData.workExperience}
                onChange={e => updateField('workExperience', parseFloat(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#0F172A] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#6366F1]"
              >
                <option value="0">None</option>
                <option value="0.5">6 months</option>
                <option value="1">1 year</option>
                <option value="2">2 years</option>
                <option value="3">3 years</option>
                <option value="4">4 years</option>
                <option value="5">5+ years</option>
              </select>
            </div>

            {/* Research Experience Toggle */}
            <div className="space-y-1.5 flex flex-col justify-end" id="field-researchExperience">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Research Experience</label>
              <button
                type="button"
                onClick={() => updateField('researchExperience', !formData.researchExperience)}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-between border transition-all ${formData.researchExperience ? 'bg-[#6366F1]/20 border-[#6366F1] text-white' : 'bg-[#0F172A] border-white/10 text-slate-400'}`}
              >
                <span>{formData.researchExperience ? 'Yes, active research background' : 'No research experience'}</span>
                <span className={`w-3 h-3 rounded-full ${formData.researchExperience ? 'bg-[#6366F1]' : 'bg-slate-600'}`}></span>
              </button>
            </div>

            {/* Publications */}
            {formData.researchExperience && (
              <div className="space-y-1.5" id="field-publications">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Number of Publications</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.publications}
                  onChange={e => updateField('publications', e.target.value)}
                  className={`w-full px-4 py-2.5 bg-[#0F172A] border rounded-xl text-sm text-white focus:outline-none ${errors.publications ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
                />
                {errors.publications && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3"/>{errors.publications}</p>}
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => { loadProfileData(); setIsDirty(false); setErrors({}); }}
              className="px-4 py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Reset Changes
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-[#6366F1] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#6366F1]/25 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save & Recalculate Score
            </button>
          </div>
        </form>

        {/* SECTION 4: IMPROVEMENT ROADMAP */}
        <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <FileText className="w-5 h-5 text-[#6366F1]" />
            <h3 className="text-lg font-bold text-white">Actionable Improvement Checklist</h3>
          </div>

          {breakdownData?.improvements?.length === 0 ? (
            <p className="text-sm text-emerald-400 font-medium">✨ Outstanding profile! No critical weak areas detected.</p>
          ) : (
            <div className="space-y-3">
              {breakdownData?.improvements?.map((imp, idx) => {
                const isDone = Boolean(checkedImprovements[idx]);
                return (
                  <div
                    key={idx}
                    onClick={() => setCheckedImprovements(p => ({ ...p, [idx]: !p[idx] }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isDone ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-400 line-through' : 'bg-[#0F172A]/80 border-white/5 text-slate-200 hover:border-[#6366F1]/40'}`}
                  >
                    {isDone ? (
                      <CheckSquare className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-[#6366F1] flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{imp}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
