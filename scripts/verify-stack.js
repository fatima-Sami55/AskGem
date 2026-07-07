#!/usr/bin/env node
/**
 * Pre-release stack verification — checks Ollama, FastAPI, Express, optional Vite dev client.
 */
const {
  OLLAMA_MODEL,
  FASTAPI_URL,
  EXPRESS_HEALTH,
  CLIENT_DEV_URL,
} = require('./lib/config');
const { checkOllamaModel } = require('./lib/ollama');

const rows = [];

function row(label, status, detail = '') {
  rows.push({ label, status, detail });
  const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  console.log(`${label.padEnd(22)} ${icon}${detail ? `  ${detail}` : ''}`);
}

async function checkOllama() {
  const result = await checkOllamaModel();
  if (!result.reachable) {
    row('Ollama :11434', 'fail', 'not reachable — run: ollama serve');
    return false;
  }
  if (!result.modelPresent) {
    row(`Model ${OLLAMA_MODEL}`, 'fail', `run: ollama pull ${OLLAMA_MODEL}`);
    return false;
  }
  row('Ollama :11434', 'pass');
  row(`Model ${OLLAMA_MODEL}`, 'pass');
  return true;
}

async function checkFastApi() {
  try {
    const res = await fetch(`${FASTAPI_URL}/health`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      row('FastAPI :8000', 'fail', `HTTP ${res.status}`);
      return false;
    }
    const body = await res.json();
    if (!body.ollama || !body.model) {
      row('FastAPI :8000', 'fail', `ollama=${body.ollama} model=${body.model}`);
      return false;
    }
    const chromaNote = body.chroma ? '' : ' (chroma degraded — OK)';
    row('FastAPI :8000', 'pass', `ollama + model ready${chromaNote}`);
    return true;
  } catch (err) {
    const refused = err.cause?.code === 'ECONNREFUSED' || String(err.message).includes('ECONNREFUSED');
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError' || String(err.message).includes('timeout');
    const msg = refused || timedOut
      ? 'not reachable — run npm run dev from repo root'
      : err.message;
    row('FastAPI :8000', 'fail', msg);
    return false;
  }
}

async function checkExpress() {
  try {
    const res = await fetch(EXPRESS_HEALTH, { signal: AbortSignal.timeout(10000) });
    const body = await res.json().catch(() => ({}));
    const ai = body.ai || {};

    if (!ai.serverReachable) {
      const errDetail = ai.serverError || 'FastAPI not reachable';
      row('Express :5000', 'fail', `ai.serverReachable=false (${errDetail})`);
      return false;
    }
    if (!ai.ollama || !ai.model) {
      row('Express :5000', 'fail', `ollama=${ai.ollama} model=${ai.model}`);
      return false;
    }
    const chromaNote = ai.chroma ? '' : ' (chroma warn only)';
    row('Express :5000', 'pass', `serverReachable + ollama + model${chromaNote}`);
    return true;
  } catch (err) {
    row('Express :5000', 'fail', err.message);
    return false;
  }
}

async function checkDevClient() {
  try {
    const res = await fetch(CLIENT_DEV_URL, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      row('Vite dev :5173', 'pass', 'optional');
    } else {
      row('Vite dev :5173', 'warn', `HTTP ${res.status} — not required for verify`);
    }
  } catch {
    row('Vite dev :5173', 'warn', 'not running — OK for prod verify');
  }
}

async function main() {
  console.log('AskPeri stack verify\n');

  const ollamaOk = await checkOllama();
  const fastApiOk = ollamaOk && (await checkFastApi());
  const expressOk = fastApiOk && (await checkExpress());
  await checkDevClient();

  console.log('');
  if (ollamaOk && fastApiOk && expressOk) {
    console.log('✅ All core checks passed');
    process.exit(0);
  }
  console.log('❌ Verify failed — fix the failed rows above');
  process.exit(1);
}

main();
