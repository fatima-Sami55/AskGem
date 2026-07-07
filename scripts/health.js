#!/usr/bin/env node
/**
 * Human-readable health report via Express /api/v1/health.
 */
const {
  OLLAMA_MODEL,
  FASTAPI_URL,
  EXPRESS_HEALTH,
} = require('./lib/config');
const { checkOllamaModel } = require('./lib/ollama');

const HINTS = {
  db: 'Check ./data/askperi.db — restart Express',
  fastapi: 'FastAPI :8000 not reachable — run npm run dev from repo root',
  ollama: 'Run: ollama serve',
  model: `Run: ollama pull ${OLLAMA_MODEL}`,
  chroma: 'Chroma path not writable — check CHROMA_PATH in ai/.env',
};

function icon(ok, warnOnly = false) {
  if (ok) return '✅';
  if (warnOnly) return '⚠️';
  return '❌';
}

async function checkFastApiDirect() {
  try {
    const res = await fetch(`${FASTAPI_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return { reachable: true, ok: false, error: `HTTP ${res.status}`, body: null };
    }
    const body = await res.json();
    return { reachable: true, ok: true, error: null, body };
  } catch (err) {
    let serverError = err.message;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') serverError = 'timeout';
    else if (err.cause?.code === 'ECONNREFUSED' || String(err.message).includes('ECONNREFUSED')) {
      serverError = 'ECONNREFUSED';
    }
    return { reachable: false, ok: false, error: serverError, body: null };
  }
}

async function main() {
  console.log('AskPeri health check\n');

  let expressBody = null;
  let expressReachable = false;

  try {
    const res = await fetch(EXPRESS_HEALTH, { signal: AbortSignal.timeout(10000) });
    expressReachable = true;
    expressBody = await res.json();
  } catch (err) {
    console.log(`Express :5000          ${icon(false)}  ${err.message}`);
    console.log(`                       → Start backend: npm run dev from repo root\n`);
  }

  const dbOk = Boolean(expressBody?.db);
  const ai = expressBody?.ai || {};
  const serverReachable = Boolean(ai.serverReachable);
  const serverError = ai.serverError || null;
  const ollamaOk = Boolean(ai.ollama);
  const modelOk = Boolean(ai.model);
  const chromaOk = Boolean(ai.chroma);

  if (expressReachable) {
    console.log(`Database             ${icon(dbOk)}`);
    if (!dbOk) console.log(`                       → ${HINTS.db}`);

    const fastApiLabel = serverReachable
      ? 'FastAPI :8000        '
      : 'FastAPI :8000        ';
    const fastApiDetail = serverReachable
      ? ''
      : ` (${serverError || 'unreachable'})`;
    console.log(`${fastApiLabel}${icon(serverReachable)}${fastApiDetail}`);
    if (!serverReachable) console.log(`                       → ${HINTS.fastapi}`);

    console.log(`Ollama               ${icon(ollamaOk)}`);
    if (!ollamaOk && serverReachable) console.log(`                       → ${HINTS.ollama}`);

    console.log(`Model ${OLLAMA_MODEL}`.padEnd(22) + icon(modelOk));
    if (!modelOk && serverReachable) console.log(`                       → ${HINTS.model}`);

    console.log(`Chroma               ${icon(chromaOk, !chromaOk)}`);
    if (!chromaOk) console.log(`                       → ${HINTS.chroma} (warn only)`);
  } else {
    const direct = await checkFastApiDirect();
    console.log(`Database             ${icon(false)}  (Express unreachable)`);
    console.log(`FastAPI :8000        ${icon(direct.reachable)}${direct.error ? ` (${direct.error})` : ''}`);
    if (!direct.reachable) console.log(`                       → ${HINTS.fastapi}`);

    const ollamaDirect = await checkOllamaModel();
    console.log(`Ollama               ${icon(ollamaDirect.reachable)}`);
    console.log(`Model ${OLLAMA_MODEL}`.padEnd(22) + icon(ollamaDirect.modelPresent));
    console.log(`Chroma               ${icon(false, true)}  (unknown — Express down)`);
  }

  console.log('');
  const coreOk = expressReachable && dbOk && serverReachable && ollamaOk && modelOk;
  if (coreOk) {
    console.log('✅ AskPeri is healthy');
    process.exit(0);
  }
  console.log('❌ AskPeri is not ready — fix the failed checks above');
  process.exit(1);
}

main();
