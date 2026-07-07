#!/usr/bin/env node
/**
 * Poll Express /api/v1/health until the API is ready (max 120s).
 * Used before starting Vite so the dev proxy does not hit ECONNREFUSED on boot.
 */
const { EXPRESS_HEALTH } = require('./lib/config');

const MAX_WAIT_MS = 120_000;
const POLL_MS = 500;

async function pollExpressHealth() {
  try {
    const res = await fetch(EXPRESS_HEALTH, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function main() {
  console.log('Waiting for Express to become healthy...');
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const health = await pollExpressHealth();
    if (health?.db && health?.ai?.serverReachable && health?.ai?.ollama && health?.ai?.model) {
      console.log('Express is ready.');
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  console.error('Express did not become healthy within 120s. Check server/.env and that FastAPI is running.');
  process.exit(1);
}

main();
