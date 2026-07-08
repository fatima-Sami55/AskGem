const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PYTHON_NOT_FOUND_MESSAGE = `
❌ Python 3.10+ was not found on this system.

AskPeri needs Python to create a virtual environment for the AI service.

What to do:
  1. Install Python 3.10 or newer from https://www.python.org/downloads/
  2. During install, check "Add Python to PATH" (Windows installer)
  3. Close and reopen your terminal, then run: npm run setup

If Python is already installed but not on PATH, reinstall and enable
"Add Python to PATH", or add your Python install folder to PATH manually.
`.trim();

function commandOnPath(cmd) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore', shell: true });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore', shell: true });
    }
    return true;
  } catch {
    return false;
  }
}

function canRun(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

function windowsPythonCandidates() {
  const candidates = [];
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env['ProgramFiles(x86)'];

  const roots = [
    localAppData ? path.join(localAppData, 'Programs', 'Python') : null,
    programFiles ? path.join(programFiles, 'Python') : null,
    programFilesX86 ? path.join(programFilesX86, 'Python') : null,
    'C:\\Python',
  ].filter(Boolean);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const exe = path.join(root, entry.name, 'python.exe');
        if (fs.existsSync(exe)) candidates.push(exe);
      }
    } catch {
      /* ignore unreadable dirs */
    }
  }

  return candidates;
}

/**
 * Resolve a Python interpreter for venv creation.
 * @returns {string|null} Command or absolute path to invoke with `-m venv`
 */
function findPythonCommand() {
  if (commandOnPath('python') && canRun('python')) return 'python';
  if (commandOnPath('python3') && canRun('python3')) return 'python3';

  if (process.platform === 'win32') {
    if (commandOnPath('py') && canRun('py -3')) return 'py -3';

    for (const exe of windowsPythonCandidates()) {
      try {
        execSync(`"${exe}" --version`, { stdio: 'ignore', shell: true });
        return `"${exe}"`;
      } catch {
        /* try next */
      }
    }
  }

  return null;
}

function requirePythonCommand() {
  const python = findPythonCommand();
  if (!python) {
    console.error(`\n${PYTHON_NOT_FOUND_MESSAGE}\n`);
    process.exit(1);
  }
  return python;
}

module.exports = {
  findPythonCommand,
  requirePythonCommand,
  PYTHON_NOT_FOUND_MESSAGE,
};
