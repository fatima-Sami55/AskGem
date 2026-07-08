import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { MascotProvider, useMascot } from '../context/MascotContext';
import InteractiveMascot from '../components/mascot/InteractiveMascot';
import '../components/mascot/InteractiveMascot.css';

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

const CHECKLIST = [
  {
    key: 'db',
    label: 'Your profile storage',
    getOk: (health) => Boolean(health?.db),
  },
  {
    key: 'ai',
    label: "Peri's brain",
    getOk: (health) => Boolean(health?.ai?.serverReachable),
  },
  {
    key: 'ollama',
    label: 'AI engine',
    getOk: (health) => Boolean(health?.ai?.ollama),
  },
  {
    key: 'model',
    label: 'Language model',
    getOk: (health) => Boolean(health?.ai?.model),
  },
  {
    key: 'chroma',
    label: 'Chat memory',
    getOk: (health) => Boolean(health?.ai?.chroma),
    warnOnly: true,
  },
];

function getPrimaryStatus({ health, error, attempts, startingUp, serverDown, ollamaDown, modelMissing, backendUnreachable }) {
  if (startingUp) {
    return {
      headline: 'Getting Peri ready on your laptop…',
      detail: "We're checking everything automatically. This usually takes under a minute.",
    };
  }

  if (backendUnreachable || (error && !health)) {
    return {
      headline: 'Waiting for AskPeri to start…',
      detail: attempts < 3
        ? 'If you just opened the app, hang tight — Peri is still waking up.'
        : 'Make sure AskPeri is running on this computer, then tap Retry below.',
    };
  }

  if (serverDown) {
    return {
      headline: 'Almost there…',
      detail: "Peri's helper services are still connecting. We'll keep checking for you.",
    };
  }

  if (ollamaDown) {
    return {
      headline: 'Peri needs Ollama to think',
      detail: 'Install Ollama from ollama.com and make sure it is running, then we will pick up from here.',
    };
  }

  if (modelMissing) {
    return {
      headline: 'One more download needed',
      detail: 'Peri needs a language model before she can chat. See technical details below if you are setting up manually.',
    };
  }

  if (health?.db && health?.ai?.serverReachable && health?.ai?.ollama && health?.ai?.model) {
    return {
      headline: 'Peri is ready!',
      detail: 'Opening your advisor…',
    };
  }

  return {
    headline: 'Getting Peri ready on your laptop…',
    detail: 'Checking that everything on your machine is good to go.',
  };
}

export default function SetupScreen(props) {
  return (
    <MascotProvider>
      <SetupScreenContent {...props} />
    </MascotProvider>
  );
}

function SetupScreenContent({ onReady }) {
  const { setAction, clearSpeech } = useMascot();
  const [checking, setChecking] = useState(true);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [showTechnical, setShowTechnical] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    setAction('thinking');
    return () => {
      setAction('idle');
      clearSpeech();
    };
  }, [setAction, clearSpeech]);

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
        setAction('celebrating');
        onReady?.();
      }
    } catch (err) {
      setAttempts((n) => n + 1);
      if (err.response?.data) {
        setHealth(err.response.data);
      }
      if (isBackendUnreachable(err)) {
        setError('backend_unreachable');
      } else if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
        setError('timeout');
      } else {
        setError('unknown');
      }
    } finally {
      if (!silent) setChecking(false);
    }
  }, [onReady, setAction]);

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

  const status = getPrimaryStatus({
    health,
    error,
    attempts,
    startingUp,
    serverDown,
    ollamaDown,
    modelMissing,
    backendUnreachable,
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] text-white p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-[#16162a] p-8 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <InteractiveMascot size={140} interactive={false} />
          <h1 className="text-2xl font-bold mt-4 text-center">{status.headline}</h1>
          <p className="text-slate-300 text-sm text-center mt-2">{status.detail}</p>
        </div>

        {health && (
          <div className="mb-6 space-y-2 text-sm rounded-xl bg-black/20 p-4">
            {CHECKLIST.map(({ key, label, getOk, warnOnly }) => (
              <StatusRow
                key={key}
                label={label}
                ok={getOk(health)}
                warnOnly={warnOnly}
              />
            ))}
          </div>
        )}

        {!health && attempts > 0 && (
          <p className="text-slate-400 text-sm mb-4 text-center">
            {checking ? 'Checking…' : 'Still looking for AskPeri on this computer…'}
          </p>
        )}

        {chromaWarn && (
          <p className="text-amber-400 text-sm mb-4">
            Chat memory may not save between sessions. Ask a parent or admin to check folder permissions if this persists.
          </p>
        )}

        <button
          type="button"
          onClick={() => checkHealth()}
          disabled={checking}
          className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5558DD] disabled:opacity-50 font-semibold transition-colors mb-4"
        >
          {checking ? 'Checking…' : 'Retry now'}
        </button>

        <div className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setShowTechnical((open) => !open)}
            className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-200 transition-colors"
            aria-expanded={showTechnical}
          >
            <span>Technical details</span>
            <span className="text-xs">{showTechnical ? '▲' : '▼'}</span>
          </button>

          {showTechnical && (
            <div className="mt-4 space-y-4 text-sm text-slate-400">
              <p>
                AskPeri runs entirely on your laptop — no cloud account required. A developer or parent
                may need to complete these one-time steps:
              </p>

              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#6366F1] flex items-center justify-center font-bold text-xs">1</span>
                  <div>
                    <p className="font-medium text-slate-200">Install Ollama</p>
                    <p>
                      Download from{' '}
                      <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-[#6366F1] underline">
                        ollama.com
                      </a>
                      {' '}— then run <code className="font-mono text-xs text-slate-300">ollama serve</code> if it is not already running
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#6366F1] flex items-center justify-center font-bold text-xs">2</span>
                  <div>
                    <p className="font-medium text-slate-200">Pull the language model</p>
                    <code className="block mt-1 px-3 py-2 rounded bg-black/30 text-[#6366F1] font-mono text-xs">
                      ollama pull gemma3:4b
                    </code>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#6366F1] flex items-center justify-center font-bold text-xs">3</span>
                  <div>
                    <p className="font-medium text-slate-200">Start AskPeri</p>
                    <code className="block mt-1 px-3 py-2 rounded bg-black/30 text-slate-300 font-mono text-xs">
                      npm run dev
                    </code>
                    <p className="text-slate-500 text-xs mt-1">
                      From the project folder — starts FastAPI (:8000), Express (:5000), and Vite (:5173)
                    </p>
                  </div>
                </li>
              </ol>

              {error && (
                <p className="text-xs text-slate-500">
                  Last check: {error === 'timeout' ? 'timed out' : error === 'backend_unreachable' ? 'backend not reachable' : 'could not connect'}
                  {attempts > 0 ? ` (attempt ${attempts})` : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, ok, warnOnly = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <span className={ok ? 'text-green-400' : warnOnly ? 'text-amber-400' : 'text-red-400'}>
        {ok ? '✓ Ready' : warnOnly ? '⚠ Optional' : '… Waiting'}
      </span>
    </div>
  );
}
