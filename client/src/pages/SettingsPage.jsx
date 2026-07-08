import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useProfile } from '../context/ProfileContext';
import { invalidateRecommendationsCache } from '../services/recommendationsCache';
import { clearAllAskperiLocalStorage } from '../utils/askperiStorage';
import ClearDataModal from '../components/ui/ClearDataModal';
import AppShell from '../components/AppShell';
import {
  ArrowLeft, Activity, Key, FolderOpen, Trash2, Download, AlertTriangle, CheckCircle2,
} from 'lucide-react';

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`text-sm font-semibold ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {ok ? 'OK' : 'Missing'}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, fetchProfile } = useProfile();
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState(null);
  const [tavilyKey, setTavilyKey] = useState('');
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [message, setMessage] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, settingsRes] = await Promise.all([
        api.get('/health'),
        api.get('/settings'),
      ]);
      setHealth(healthRes.data);
      const settingsData = settingsRes.data?.data || null;
      setSettings(settingsData);
      setTavilyKey('');
    } catch (err) {
      setMessage({ type: 'error', text: 'Could not load settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveTavily = async () => {
    setSavingKey(true);
    setMessage(null);
    try {
      await api.put('/settings/tavily', { tavilyApiKey: tavilyKey.trim() });
      await loadData();
      setMessage({ type: 'success', text: 'Tavily key saved to ai/.env.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save key.' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveTavily = async () => {
    const confirmed = window.confirm(
      'Remove the Tavily API key from ai/.env?',
    );
    if (!confirmed) return;

    setSavingKey(true);
    setMessage(null);
    try {
      await api.put('/settings/tavily', { tavilyApiKey: '' });
      setTavilyKey('');
      await loadData();
      setMessage({ type: 'success', text: 'Tavily key removed from ai/.env.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove key.' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleExportProfile = () => {
    if (!user) return;
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `askperi-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    setClearing(true);
    setMessage(null);
    try {
      await api.post('/settings/clear-all', null, {
        headers: { 'X-AskPeri-Confirm': 'clear-all' },
      });
      clearAllAskperiLocalStorage();
      invalidateRecommendationsCache();
      await fetchProfile({ silent: true });
      setShowClearModal(false);
      setMessage({ type: 'success', text: 'All local data cleared. Reloading…' });
      setTimeout(() => {
        window.location.href = '/';
      }, 800);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Clear data failed.' });
    } finally {
      setClearing(false);
    }
  };

  const ai = health?.ai || {};

  return (
    <AppShell title="Settings">
    <div className="font-sans">
      <div className="max-w-4xl xl:max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-6">
        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'}`}>
            {message.type === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {message.text}
          </div>
        )}

        <section className="bg-[#16162a] border border-white/10 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-[#6366F1]" />
            <h2 className="text-lg font-bold">Health status</h2>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              <StatusRow label="Local database" ok={health?.db} />
              <StatusRow label="Ollama running" ok={ai.ollama} />
              <StatusRow label={`Model ${settings?.ollamaModel || 'gemma3:4b'}`} ok={ai.model} />
              <StatusRow label="ChromaDB writable" ok={ai.chroma} />
            </>
          )}
        </section>

        <section className="bg-[#16162a] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold">Tavily API key (optional)</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Improves web search quality. Without it, AskPeri falls back to DuckDuckGo with generalized queries.
            Get a key at{' '}
            <a href="https://tavily.com" target="_blank" rel="noreferrer" className="text-[#6366F1] underline">
              tavily.com
            </a>
            . You can also set <code className="text-[#818cf8]">TAVILY_API_KEY</code> directly in <code className="text-[#818cf8]">ai/.env</code>.
          </p>
          {loading ? (
            <p className="text-xs text-slate-400">Checking Tavily key…</p>
          ) : settings?.tavilyConfigured ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-green-400">Tavily key found</p>
              {settings.tavilyMasked && (
                <p className="text-xs text-slate-400">
                  Key ending <code className="text-[#818cf8]">{settings.tavilyMasked}</code>
                  {' — stored in ai/.env'}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-amber-300">No key found</p>
          )}
          <div className="relative">
            <input
              type={showTavilyKey ? 'text' : 'password'}
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              placeholder={settings?.tavilyConfigured ? 'Enter new key to update…' : 'tvly-...'}
              className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 pr-20 text-sm focus:outline-none focus:border-[#6366F1]"
            />
            <button
              type="button"
              onClick={() => setShowTavilyKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              {showTavilyKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveTavily}
              disabled={savingKey || !tavilyKey.trim()}
              className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5558DD] disabled:opacity-50 text-[#0f0f1a] text-sm font-semibold transition-colors"
            >
              {savingKey ? 'Saving…' : settings?.tavilyConfigured ? 'Update key' : 'Save key'}
            </button>
            <button
              type="button"
              onClick={handleRemoveTavily}
              disabled={savingKey || !settings?.tavilyConfigured}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 text-sm font-semibold transition-colors"
            >
              Remove key
            </button>
          </div>
        </section>

        <section className="bg-[#16162a] border border-white/10 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#818cf8]" />
            <h2 className="text-lg font-bold">Data directory</h2>
          </div>
          <p className="text-xs text-slate-400">Profile and sessions are stored here:</p>
          <code className="block text-xs bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2.5 text-[#6366F1] break-all">
            {settings?.dataDir || '…'}
          </code>
          <p className="text-[10px] text-slate-500">Chroma vectors: <span className="text-slate-400">{settings?.chromaPath || './data/chroma_data'}</span></p>
        </section>

        <section className="bg-[#16162a] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[#34D399]" />
            <h2 className="text-lg font-bold">Export profile</h2>
          </div>
          <p className="text-xs text-slate-400">Download your current profile as JSON.</p>
          <button
            type="button"
            onClick={handleExportProfile}
            disabled={!user}
            className="px-4 py-2 rounded-xl border border-[#34D399]/40 text-[#34D399] hover:bg-[#34D399]/10 disabled:opacity-50 text-sm font-semibold transition-colors"
          >
            Export profile JSON
          </button>
        </section>

        <section className="bg-[#16162a] border border-red-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold text-red-300">Clear all data</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Wipes SQLite profile and sessions, Chroma memory, Tavily key in ai/.env,
            bookmarks, recommendation caches, and local profile drafts. You will see the onboarding wizard again.
          </p>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            disabled={clearing}
            className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 disabled:opacity-50 text-sm font-semibold transition-colors"
          >
            Clear all data
          </button>
        </section>

        <p className="text-center text-xs text-slate-500 pb-8">
          <Link to="/profile" className="text-[#818cf8] hover:underline">Profile</Link>
          {' · '}
          <Link to="/chat" className="text-[#818cf8] hover:underline">Chat</Link>
        </p>
      </div>

      <ClearDataModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearAll}
        onExport={handleExportProfile}
        clearing={clearing}
      />
    </div>
    </AppShell>
  );
}
