const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  getUser,
  updateUser,
  getSessions,
  deleteSession,
  DEFAULT_PROFILE,
  DATA_DIR,
  DB_PATH,
} = require('../db');
const { getAiServerUrl, getAiServerHeaders } = require('../utils/aiServerClient');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const AI_ENV_PATH = path.join(__dirname, '..', '..', 'ai', '.env');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSettingsFile() {
  ensureDataDir();
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeSettingsFile(data) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function maskKey(key) {
  if (!key || key.length < 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function readAiEnvTavilyKey() {
  try {
    if (!fs.existsSync(AI_ENV_PATH)) return '';
    const parsed = dotenv.parse(fs.readFileSync(AI_ENV_PATH));
    return (parsed.TAVILY_API_KEY || '').trim();
  } catch {
    return '';
  }
}

function getTavilyKeySource() {
  const file = readSettingsFile();
  if (file.tavilyApiKey) return 'settings';
  if ((process.env.TAVILY_API_KEY || '').trim()) return 'server-env';
  if (readAiEnvTavilyKey()) return 'ai-env';
  return null;
}

function getEffectiveTavilyKey() {
  const file = readSettingsFile();
  return (
    (file.tavilyApiKey || process.env.TAVILY_API_KEY || readAiEnvTavilyKey() || '')
      .trim()
  );
}

exports.getSettings = catchAsync(async (req, res) => {
  const tavilyKey = getEffectiveTavilyKey();
  const tavilySource = getTavilyKeySource();

  res.status(200).json({
    status: 'success',
    data: {
      dataDir: path.resolve(DATA_DIR),
      dbPath: path.resolve(DB_PATH),
      chromaPath: process.env.CHROMA_PATH || path.resolve(__dirname, '..', '..', 'ai', 'chroma_data'),
      ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
      tavilyConfigured: Boolean(tavilyKey),
      tavilyMasked: tavilyKey ? maskKey(tavilyKey) : null,
      tavilyApiKey: tavilyKey || '',
      tavilySource,
    },
  });
});

exports.updateTavilyKey = catchAsync(async (req, res) => {
  const key = String(req.body?.tavilyApiKey || '').trim();
  const file = readSettingsFile();

  if (key) {
    file.tavilyApiKey = key;
  } else {
    delete file.tavilyApiKey;
  }

  writeSettingsFile(file);
  process.env.TAVILY_API_KEY = key;

  try {
    await fetch(`${getAiServerUrl()}/settings/tavily`, {
      method: 'PUT',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ tavily_api_key: key }),
    });
  } catch (err) {
    console.warn('[Settings] Could not sync Tavily key to AI server:', err.message);
  }

  res.status(200).json({
    status: 'success',
    message: key ? 'Tavily key saved.' : 'Tavily key removed.',
    data: { tavilyConfigured: Boolean(key), tavilyMasked: key ? maskKey(key) : null, tavilyApiKey: key || '' },
  });
});

exports.clearAllData = catchAsync(async (req, res) => {
  const userId = 'local-user';

  const sessions = getSessions();
  for (const session of sessions) {
    try {
      await fetch(`${getAiServerUrl()}/memory/${encodeURIComponent(userId)}/session/${encodeURIComponent(session._id)}`, {
        method: 'DELETE',
        headers: getAiServerHeaders(),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      console.warn(`[Settings] Memory delete for session ${session._id}:`, err.message);
    }
    deleteSession(session._id);
  }

  try {
    await fetch(`${getAiServerUrl()}/memory/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.warn('[Settings] Full memory wipe:', err.message);
  }

  updateUser({
    name: 'Student',
    profile: { ...DEFAULT_PROFILE },
    sessionCreations: [],
  });

  res.status(200).json({
    status: 'success',
    message: 'All local data cleared.',
  });
});

exports.readSettingsFile = readSettingsFile;
exports.getEffectiveTavilyKey = getEffectiveTavilyKey;
exports.SETTINGS_PATH = SETTINGS_PATH;
