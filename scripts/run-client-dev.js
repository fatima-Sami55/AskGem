#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { ROOT } = require('./lib/config');

const waitScript = path.join(__dirname, 'wait-for-server.js');
console.log('Waiting for Express before starting Vite...');
const waitResult = spawnSync('node', [waitScript], { stdio: 'inherit', cwd: ROOT });
if (waitResult.status !== 0) {
  console.error('Express wait failed — Vite will not start.');
  process.exit(waitResult.status ?? 1);
}

console.log('Starting Vite on http://127.0.0.1:5173 ...');
const clientDir = path.join(ROOT, 'client');
const child = spawn('npm', ['run', 'dev'], {
  cwd: clientDir,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
