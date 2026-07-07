#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { ROOT } = require('./lib/config');

const waitScript = path.join(__dirname, 'wait-for-ai.js');
const waitResult = spawnSync('node', [waitScript], { stdio: 'inherit', cwd: ROOT });
if (waitResult.status !== 0) {
  process.exit(waitResult.status ?? 1);
}

const serverDir = path.join(ROOT, 'server');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npm, ['run', 'dev'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
