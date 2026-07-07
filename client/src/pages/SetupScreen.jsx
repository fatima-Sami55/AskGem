import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function SetupScreen({ onReady }) {
  const [checking, setChecking] = useState(true);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await api.get('/health');
      setHealth(res.data);
      const ai = res.data?.ai || {};
      const coreReady = ai.serverReachable && ai.ollama && ai.model;
      if (coreReady) {
        onReady?.();
      }
    } catch (err) {
      setHealth(err.response?.data || null);
      setError('Could not reach the AskPeri backend. Make sure all services are running.');
    } finally {
      setChecking(false);
    }
  }, [onReady]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const ai = health?.ai || {};
  const serverDown = ai.serverReachable === false;
  const modelMissing = ai.serverReachable && ai.ollama && !ai.model;
  const chromaWarn = ai.serverReachable && ai.ollama && ai.model && !ai.chroma;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-[#1e293b] p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">AskPeri Setup</h1>
        <p className="text-slate-300 mb-6">
          AskPeri runs entirely on your machine. Complete these steps before using the app.
        </p>

        <ol className="space-y-4 mb-8 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#39B1D1]/20 text-[#39B1D1] flex items-center justify-center font-bold text-xs">1</span>
            <div>
              <p className="font-medium">Install Ollama</p>
              <p className="text-slate-400">
                Download from{' '}
                <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-[#39B1D1] underline">
                  ollama.com
                </a>
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#39B1D1]/20 text-[#39B1D1] flex items-center justify-center font-bold text-xs">2</span>
            <div>
              <p className="font-medium">Pull the model</p>
              <code className="block mt-1 px-3 py-2 rounded bg-black/30 text-[#39B1D1] font-mono text-xs">
                ollama pull gemma3:4b
              </code>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#39B1D1]/20 text-[#39B1D1] flex items-center justify-center font-bold text-xs">3</span>
            <div>
              <p className="font-medium">Start AskPeri</p>
              <code className="block mt-1 px-3 py-2 rounded bg-black/30 text-slate-300 font-mono text-xs">
                npm run dev
              </code>
              <p className="text-slate-500 text-xs mt-1">From the repo root — not server/ alone</p>
            </div>
          </li>
        </ol>

        {health && (
          <div className="mb-6 space-y-2 text-sm">
            <StatusRow label="Local database" ok={health.db} />
            <StatusRow label="AI server (FastAPI :8000)" ok={ai.serverReachable} />
            <StatusRow label="Ollama running" ok={ai.ollama} />
            <StatusRow label="Model gemma3:4b pulled" ok={ai.model} />
            <StatusRow label="ChromaDB writable" ok={ai.chroma} warnOnly />
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {serverDown && (
          <p className="text-red-400 text-sm mb-4">
            AI server not running — run <code className="font-mono">npm run dev</code> from repo root
            {ai.serverError ? ` (${ai.serverError})` : ''}
          </p>
        )}
        {modelMissing && (
          <p className="text-amber-400 text-sm mb-4">
            Ollama is running but gemma3:4b is not installed. Run: ollama pull gemma3:4b
          </p>
        )}
        {chromaWarn && (
          <p className="text-amber-400 text-sm mb-4">
            ChromaDB is not writable — memory features may fail. Check CHROMA_PATH in ai/.env.
          </p>
        )}

        <button
          type="button"
          onClick={checkHealth}
          disabled={checking}
          className="w-full py-3 rounded-xl bg-[#39B1D1] hover:bg-[#2da0bf] disabled:opacity-50 font-semibold transition-colors"
        >
          {checking ? 'Checking…' : 'Retry'}
        </button>
      </div>
    </div>
  );
}

function StatusRow({ label, ok, warnOnly = false }) {
  const showOk = ok || (warnOnly && ok === false);
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <span className={ok ? 'text-green-400' : warnOnly ? 'text-amber-400' : 'text-red-400'}>
        {ok ? '✓ OK' : warnOnly ? '⚠ Warning' : '✗ Missing'}
      </span>
    </div>
  );
}
