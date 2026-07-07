#!/usr/bin/env node
/**
 * Production launcher: FastAPI + Express (serves client/dist).
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT, getVenvPython } = require('./lib/config');
const { checkOllamaModel } = require('./lib/ollama');

const distDir = path.join(ROOT, 'client', 'dist');
const python = getVenvPython();
const aiDir = path.join(ROOT, 'ai');
const serverDir = path.join(ROOT, 'server');
const waitScript = path.join(__dirname, 'wait-for-ai.js');

const children = [];

function shutdown() {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('❌ client/dist not found. Run npm run build first.');
    process.exit(1);
  }

  if (!fs.existsSync(python)) {
    console.error('❌ Python venv not found. Run: npm run setup && npm run setup:ai');
    process.exit(1);
  }

  const ollama = await checkOllamaModel();
  if (!ollama.reachable) {
    console.error('❌ Ollama is not reachable. Run: ollama serve');
    process.exit(1);
  }
  if (!ollama.modelPresent) {
    console.error(`❌ Model '${ollama.modelName}' not found. Run: ollama pull ${ollama.modelName}`);
    process.exit(1);
  }

  console.log('Starting FastAPI (127.0.0.1:8000)...');
  const aiChild = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: aiDir,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  children.push(aiChild);

  aiChild.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`FastAPI exited with code ${code}`);
      shutdown();
    }
  });

  const waitResult = spawnSync('node', [waitScript], { stdio: 'inherit', cwd: ROOT });
  if (waitResult.status !== 0) {
    shutdown();
    return;
  }

  console.log('Starting Express (production, 127.0.0.1:5000)...');
  const serverChild = spawn('node', ['server.js'], {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
    shell: process.platform === 'win32',
  });
  children.push(serverChild);

  serverChild.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  console.log('\n============================================');
  console.log('  AskPeri → http://127.0.0.1:5000');
  console.log('  Press Ctrl+C to stop');
  console.log('============================================\n');
}

main();
