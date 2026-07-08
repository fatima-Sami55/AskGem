#!/usr/bin/env node
/**
 * Poll Express until the API is accepting connections (max 120s).
 * Used before starting Vite so the dev proxy does not hit ECONNREFUSED on boot.
 *
 * Uses the lightweight /api/v1/health/live endpoint (DB only, no FastAI proxy).
 * Full AI readiness is handled by SetupScreen and verify/health scripts.
 */
const { EXPRESS_URL } = require('./lib/config');

const LIVE_HEALTH = `${EXPRESS_URL}/api/v1/health/live`;
const MAX_WAIT_MS = 120_000;
const POLL_MS = 500;
const FETCH_TIMEOUT_MS = 10_000;

async function pollExpressLive() {
  try {
    const res = await fetch(LIVE_HEALTH, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  let lastLog = Date.now();

  while (Date.now() < deadline) {
    const health = await pollExpressLive();
    if (health?.status === 'ok' && health?.db) {
      console.log('Express is ready.');
      process.exit(0);
    }

    if (Date.now() - lastLog >= 15_000) {
      console.log('  Still waiting for Express on http://127.0.0.1:5000 ...');
      lastLog = Date.now();
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  console.error(
    'Express did not become healthy within 120s. Check server/.env and that port 5000 is free.',
  );
  process.exit(1);
}

main();
