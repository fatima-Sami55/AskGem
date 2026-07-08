#!/usr/bin/env node
/**
 * Install Python dependencies into ai/venv using the venv interpreter
 * (never global pip — works when python/pip are not on PATH).
 */
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const { getVenvPython, getAiDir } = require('./lib/config');
const { requirePythonCommand } = require('./lib/findPython');

function runShell(cmd, cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function ensureVenv() {
  const python = getVenvPython();
  if (fs.existsSync(python)) return;

  const aiDir = getAiDir();
  console.log('Python venv not found — creating ai/venv …');
  const python = requirePythonCommand();
  runShell(`${python} -m venv venv`, aiDir);

  if (!fs.existsSync(getVenvPython())) {
    console.error(
      '\n❌ Could not create ai/venv. Install Python 3.10+ and run npm run setup first.',
    );
    process.exit(1);
  }
}

ensureVenv();

const aiDir = getAiDir();
const python = getVenvPython();
console.log(`Using venv Python: ${python}`);

const result = spawnSync(
  python,
  ['-m', 'pip', 'install', '-r', 'requirements.txt'],
  { cwd: aiDir, stdio: 'inherit', shell: false },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('\n✅ AI dependencies installed.');
