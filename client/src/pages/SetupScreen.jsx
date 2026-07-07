import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

const POLL_MS = 3000;
const HEALTH_TIMEOUT_MS = 8000;

function isBackendUnreachable(err) {
  const msg = err?.message || '';
  return (
    err?.code === 'ERR_NETWORK'
    || err?.code === 'ECONNREFUSED'
    || /network error/i.test(msg)
    || /ECONNREFUSED/i.test(msg)
  );
}

export default function SetupScreen({ onReady }) {
  const [checking, setChecking] = useState(true);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const readyRef = useRef(false);

  const checkHealth = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    setError(null);
    try {
      const res = await api.get('/health', {
        validateStatus: (status) => status < 600,
        timeout: HEALTH_TIMEOUT_MS,
      });
      setHealth(res.data);
      setAttempts((n) => n + 1);

  const ai = res.data?.ai || {};
      const coreReady = res.data?.db && ai.serverReachable && ai.ollama && ai.model;
      if (coreReady && !readyRef.current) {
        readyRef.current = true;
        onReady?.();
      }
    } catch (err) {
      setAttempts((n) => n + 1);
      if (err.response?.data) {
        setHealth(err.response.data);
      }
      if (isBackendUnreachable(err)) {
        setError('Express backend (:5000) is not running yet. Wait for npm run dev to finish starting all services, then retry.');
      } else if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
        setError('Backend health check timed out. Services may still be starting — try again in a few seconds.');
      } else {
        setError('Could not reach the AskPeri backend. Make sure all services are running.');
      }
    } finally {
      if (!silent) setChecking(false);
    }
  }, [onReady]);

  useEffect(() => {
    checkHealth();
    const id = setInterval(() => {
      if (!readyRef.current) checkHealth(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [checkHealth]);

  const ai = health?.ai || {};
  const serverDown = ai.serverReachable === false;
  const modelMissing = ai.serverReachable && ai.ollama && !ai.model;
  const ollamaDown = ai.serverReachable && !ai.ollama;
  const chromaWarn = ai.serverReachable && ai.ollama && ai.model && !ai.chroma;
  const backendUnreachable = Boolean(error) && !health;
  const startingUp = attempts > 0 && (serverDown || backendUnreachable) && attempts < 40;

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
                {' '}— then run <code className="font-mono text-xs">ollama serve</code> if it is not already running
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
              <p className="text-slate-500 text-xs mt-1">From the repo root — starts FastAPI (:8000), Express (:5000), and Vite (:5173)</p>
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

        {error && !startingUp && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {startingUp && (
          <p className="text-slate-400 text-sm mb-4">
            Services are starting… Express waits for FastAPI, then boots on :5000 (attempt {attempts}).
          </p>
        )}
        {serverDown && !startingUp && !backendUnreachable && (
          <p className="text-amber-400 text-sm mb-4">
            Express is up but cannot reach FastAPI on port 8000
            {ai.serverError ? ` (${ai.serverError})` : ''}.
            Ensure <code className="font-mono">AI_SERVER_URL=http://127.0.0.1:8000</code> in server/.env, then retry.
          </p>
        )}
        {ollamaDown && (
          <p className="text-amber-400 text-sm mb-4">
            FastAPI is up but Ollama is not responding. Open a terminal and run <code className="font-mono">ollama serve</code>, then retry.
          </p>
        )}
        {modelMissing && (
          <p className="text-amber-400 text-sm mb-4">
            Ollama is running but gemma3:4b is not installed. Run: ollama pull gemma3:4b
          </p>
        )}
        {chromaWarn && (
          <p className="text-amber-400 text-sm mb-4">
            ChromaDB is not writable — chat memory may not persist. Check folder permissions for <code className="font-mono">data/chroma_data</code>.
          </p>
        )}

        <button
          type="button"
          onClick={() => checkHealth()}
          disabled={checking}
          className="w-full py-3 rounded-xl bg-[#39B1D1] hover:bg-[#2da0bf] disabled:opacity-50 font-semibold transition-colors"
        >
          {checking ? 'Checking…' : 'Retry now'}
        </button>
      </div>
    </div>
  );
}

function StatusRow({ label, ok, warnOnly = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <span className={ok ? 'text-green-400' : warnOnly ? 'text-amber-400' : 'text-red-400'}>
        {ok ? '✓ OK' : warnOnly ? '⚠ Warning' : '✗ Missing'}
      </span>
    </div>
  );
}
