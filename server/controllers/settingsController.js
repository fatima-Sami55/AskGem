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
const AI_ENV_PATH = path.resolve(__dirname, '..', '..', 'ai', '.env');
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_CHROMA_PATH = path.join(REPO_ROOT, 'data', 'chroma_data');

function resolveChromaPath() {
  const chromaEnv = (process.env.CHROMA_PATH || '').trim();
  const raw = chromaEnv || DEFAULT_CHROMA_PATH;
  return path.isAbsolute(raw) ? raw : path.resolve(raw);
}

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

async function syncTavilyKeyToAiRuntime(key) {
  const normalized = (key || '').trim();
  let response;
  try {
    response = await fetch(`${getAiServerUrl()}/settings/tavily`, {
      method: 'PUT',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ tavily_api_key: normalized }),
    });
  } catch (err) {
    throw new AppError(
      'Could not reach the AI server to update your Tavily key. Make sure AskPeri is fully running, then try again.',
      503,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AppError(
      `Failed to update Tavily key (${response.status}). ${detail.slice(0, 200)}`.trim(),
      response.status >= 500 ? 503 : response.status,
    );
  }
}

function assertTavilyKeyOnDisk(expectedKey) {
  const onDisk = readAiEnvTavilyKey();
  if (onDisk !== expectedKey) {
    throw new AppError(
      expectedKey
        ? 'Tavily key could not be saved to ai/.env. Please try again.'
        : 'Tavily key could not be removed from ai/.env. Please try again.',
      500,
    );
  }
}

exports.getSettings = catchAsync(async (req, res) => {
  const tavilyKey = readAiEnvTavilyKey();

  res.status(200).json({
    status: 'success',
    data: {
      dataDir: path.resolve(DATA_DIR),
      dbPath: path.resolve(DB_PATH),
      chromaPath: resolveChromaPath(),
      ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
      tavilyConfigured: Boolean(tavilyKey),
      tavilyMasked: tavilyKey ? maskKey(tavilyKey) : null,
      tavilySource: tavilyKey ? 'ai-env' : null,
    },
  });
});

exports.updateTavilyKey = catchAsync(async (req, res) => {
  const key = String(req.body?.tavilyApiKey || '').trim();

  await syncTavilyKeyToAiRuntime(key);
  assertTavilyKeyOnDisk(key);

  res.status(200).json({
    status: 'success',
    message: key ? 'Tavily key saved to ai/.env.' : 'Tavily key removed from ai/.env.',
    data: { tavilyConfigured: Boolean(key), tavilyMasked: key ? maskKey(key) : null },
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

  writeSettingsFile({});
  await syncTavilyKeyToAiRuntime('');
  assertTavilyKeyOnDisk('');

  res.status(200).json({
    status: 'success',
    message: 'All local data cleared.',
  });
});

exports.readSettingsFile = readSettingsFile;
exports.SETTINGS_PATH = SETTINGS_PATH;
