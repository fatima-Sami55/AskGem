#!/usr/bin/env node
/**
 * Install all dependencies and ensure the data directory exists.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');

function run(cmd, cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Created data directory at ${dataDir}`);
}

run('npm install', path.join(root, 'server'));
run('npm install', path.join(root, 'client'));

const aiDir = path.join(root, 'ai');
const venvDir = path.join(aiDir, 'venv');
if (!fs.existsSync(venvDir)) {
  try {
    run('python -m venv venv', aiDir);
  } catch {
    run('python3 -m venv venv', aiDir);
  }
}

console.log('\n✅ Setup complete. Next: npm run setup:ai (Python deps), then npm run dev from repo root');
