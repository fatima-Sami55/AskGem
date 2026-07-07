#!/usr/bin/env node
/**
 * Poll FastAPI /health until ollama + model are ready (max 120s).
 * Used before starting Express in dev/prod launchers.
 */
const { FASTAPI_URL } = require('./lib/config');
const { checkOllamaModel } = require('./lib/ollama');

const MAX_WAIT_MS = 120_000;
const POLL_MS = 500;

async function pollFastApiHealth() {
  try {
    const res = await fetch(`${FASTAPI_URL}/health`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function main() {
  const ollamaCheck = await checkOllamaModel();
  if (!ollamaCheck.reachable) {
    console.error('Ollama is not reachable. Run: ollama serve');
    process.exit(1);
  }
  if (!ollamaCheck.modelPresent) {
    console.error(`Model '${ollamaCheck.modelName}' not found. Run: ollama pull ${ollamaCheck.modelName}`);
    process.exit(1);
  }

  console.log('Waiting for FastAPI to become healthy...');
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const health = await pollFastApiHealth();
    if (health?.ollama && health?.model) {
      console.log('FastAPI is ready.');
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  console.error('FastAPI did not become healthy within 120s. Check ai/.env and Ollama.');
  process.exit(1);
}

main();
