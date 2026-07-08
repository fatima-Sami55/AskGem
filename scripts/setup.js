#!/usr/bin/env node
/**
 * Install all dependencies and ensure the data directory exists.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT, getAiDir, getVenvDir } = require('./lib/config');
const { requirePythonCommand } = require('./lib/findPython');

const root = ROOT;
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

const aiDir = getAiDir();
const venvDir = getVenvDir();
if (!fs.existsSync(venvDir)) {
  const python = requirePythonCommand();
  run(`${python} -m venv venv`, aiDir);
}

console.log('\n✅ Setup complete. Next: npm run setup:ai (Python deps), then npm run dev from repo root');
