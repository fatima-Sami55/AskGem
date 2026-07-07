const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const FASTAPI_URL = process.env.AI_SERVER_URL || 'http://127.0.0.1:8000';
const EXPRESS_URL = process.env.API_URL?.replace(/\/api\/v1\/?$/, '') || 'http://127.0.0.1:5000';
const EXPRESS_HEALTH = `${EXPRESS_URL}/api/v1/health`;
const CLIENT_DEV_URL = 'http://127.0.0.1:5173';

function getVenvPython() {
  const isWin = process.platform === 'win32';
  return path.join(ROOT, 'ai', 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');
}

module.exports = {
  ROOT,
  OLLAMA_URL,
  OLLAMA_MODEL,
  FASTAPI_URL,
  EXPRESS_URL,
  EXPRESS_HEALTH,
  CLIENT_DEV_URL,
  getVenvPython,
};
