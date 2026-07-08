#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { ROOT } = require('./lib/config');

const waitScript = path.join(__dirname, 'wait-for-ai.js');

console.log('Waiting for FastAPI before starting Express...');
const waitResult = spawnSync('node', [waitScript], { stdio: 'inherit', cwd: ROOT });
if (waitResult.status !== 0) {
  console.error('FastAPI wait failed — Express will not start.');
  process.exit(waitResult.status ?? 1);
}

console.log('Starting Express on http://127.0.0.1:5000 ...');
const serverDir = path.join(ROOT, 'server');
const child = spawn(process.execPath, ['server.js'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
});

child.on('exit', (code) => process.exit(code ?? 0));
