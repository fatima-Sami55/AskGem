#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const { ROOT, getVenvPython } = require('./lib/config');

const python = getVenvPython();
const aiDir = path.join(ROOT, 'ai');

const child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--no-access-log'], {
  cwd: aiDir,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
