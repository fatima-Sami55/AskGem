#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const { ROOT } = require('./lib/config');

const clientDir = path.join(ROOT, 'client');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npm, ['run', 'dev'], {
  cwd: clientDir,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
