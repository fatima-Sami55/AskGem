#!/usr/bin/env node
/**
 * Unified dev launcher — starts FastAPI, Express, and Vite via concurrently.
 * Always run from repo root: npm run dev
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT, getVenvPython } = require('./lib/config');
const { checkOllamaModel } = require('./lib/ollama');

const isWin = process.platform === 'win32';
const python = getVenvPython();

function ensureEnvFiles() {
  const pairs = [
    [path.join(ROOT, 'server', '.env'), path.join(ROOT, 'server', '.env.example')],
    [path.join(ROOT, 'ai', '.env'), path.join(ROOT, 'ai', '.env.example')],
  ];
  for (const [envPath, examplePath] of pairs) {
    if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log(`Created ${path.relative(ROOT, envPath)} from example`);
    }
  }
}

function ensureVenv() {
  if (fs.existsSync(python)) return;
  console.log('Creating Python virtual environment...');
  const aiDir = path.join(ROOT, 'ai');
  const py = spawnSync('python', ['--version'], { shell: true }).status === 0 ? 'python' : 'python3';
  spawnSync(py, ['-m', 'venv', 'venv'], { cwd: aiDir, stdio: 'inherit', shell: true });
  if (!fs.existsSync(python)) {
    console.error('❌ Failed to create Python venv. Install Python 3.10+ and run npm run setup:ai');
    process.exit(1);
  }
}

async function main() {
  console.log('=== AskPeri dev launcher ===\n');

  const ollama = await checkOllamaModel();
  if (!ollama.reachable) {
    console.error('❌ Ollama is not reachable. Install from https://ollama.com and run: ollama serve');
    process.exit(1);
  }
  if (!ollama.modelPresent) {
    console.error(`❌ Model '${ollama.modelName}' not found. Run: ollama pull ${ollama.modelName}`);
    process.exit(1);
  }
  console.log(`✓ Ollama + ${ollama.modelName} ready\n`);

  ensureEnvFiles();
  ensureVenv();

  const wrap = (cmd) => (isWin ? `"${cmd}"` : cmd);
  const aiCmd = wrap('node scripts/run-ai-dev.js');
  const serverCmd = wrap('node scripts/run-server-dev.js');
  const clientCmd = wrap('node scripts/run-client-dev.js');

  console.log('Starting full stack (FastAPI + Express + Vite)...\n');
  console.log('  App:  http://127.0.0.1:5173');
  console.log('  API:  http://127.0.0.1:5000');
  console.log('  AI:   http://127.0.0.1:8000\n');

  const proc = spawn(
    isWin ? 'npx.cmd' : 'npx',
    [
      'concurrently',
      '-k',
      '-n', 'ai,server,client',
      '-c', 'blue,green,magenta',
      aiCmd,
      serverCmd,
      clientCmd,
    ],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  );

  proc.on('exit', (code) => process.exit(code ?? 0));
}

main();
