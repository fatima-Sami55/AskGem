const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'askperi.db');

let db;

const DEFAULT_PROFILE = {
  gpa: null,
  educationLevel: null,
  maxBudget: null,
  residency: null,
  preferredCountries: [],
  avatar: 'default-pfp.png',
  age: null,
  major: null,
  englishTest: { testType: 'None', score: null },
  workExperience: 0,
  researchExperience: false,
  publications: 0,
  targetDegree: null,
  profileScore: null,
  admissionChance: null,
};

const PROFILE_FIELDS = [
  'gpa', 'educationLevel', 'maxBudget', 'residency', 'preferredCountries',
  'age', 'major', 'englishTest', 'workExperience', 'researchExperience',
  'publications', 'targetDegree',
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function isEmptyProfileValue(field, value) {
  if (value === null || value === undefined || value === '') return true;
  if (field === 'preferredCountries' && Array.isArray(value) && value.length === 0) return true;
  if (field === 'englishTest' && (!value.testType || value.testType === 'None')) return true;
  return false;
}

function mergeContextIntoProfile(profile, context, nameRef) {
  let changed = false;

  if (context.name && !nameRef.current) {
    nameRef.current = context.name;
    changed = true;
  }

  for (const field of PROFILE_FIELDS) {
    const ctxVal = context[field];
    if (ctxVal === null || ctxVal === undefined) continue;

    if (field === 'preferredCountries') {
      if (Array.isArray(ctxVal) && ctxVal.length > 0 && isEmptyProfileValue(field, profile[field])) {
        profile[field] = ctxVal;
        changed = true;
      }
      continue;
    }

    if (field === 'englishTest') {
      if (ctxVal?.testType && ctxVal.testType !== 'None' && isEmptyProfileValue(field, profile[field])) {
        profile[field] = ctxVal;
        changed = true;
      }
      continue;
    }

    if (isEmptyProfileValue(field, profile[field])) {
      profile[field] = ctxVal;
      changed = true;
    }
  }

  return changed;
}

function migrateDropExtractedContext() {
  const columns = db.prepare('PRAGMA table_info(chat_sessions)').all();
  const hasExtracted = columns.some((c) => c.name === 'extracted_context_json');
  if (!hasExtracted) return;

  console.log('[DB] Migrating: merging legacy session context into profile, dropping column…');

  const profileRow = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  if (profileRow) {
    const user = rowToUser(profileRow);
    const nameRef = { current: user.name };
    let profileChanged = false;

    const sessions = db.prepare('SELECT extracted_context_json FROM chat_sessions').all();
    for (const row of sessions) {
      const ctx = parseJson(row.extracted_context_json, {});
      if (mergeContextIntoProfile(user.profile, ctx, nameRef)) {
        profileChanged = true;
      }
    }

    if (profileChanged || nameRef.current !== user.name) {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE profile SET name = ?, profile_json = ?, updated_at = ? WHERE id = 1
      `).run(nameRef.current, JSON.stringify(user.profile), now);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions_new (
      id TEXT PRIMARY KEY,
      messages_json TEXT NOT NULL DEFAULT '[]',
      is_closed INTEGER NOT NULL DEFAULT 0,
      generated_roadmap_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO chat_sessions_new (id, messages_json, is_closed, generated_roadmap_json, created_at, updated_at)
    SELECT id, messages_json, is_closed, generated_roadmap_json, created_at, updated_at FROM chat_sessions;
    DROP TABLE chat_sessions;
    ALTER TABLE chat_sessions_new RENAME TO chat_sessions;
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);
  `);

  console.log('[DB] Migration complete — extracted_context_json removed');
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Student',
      profile_json TEXT NOT NULL DEFAULT '{}',
      session_creations_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      messages_json TEXT NOT NULL DEFAULT '[]',
      is_closed INTEGER NOT NULL DEFAULT 0,
      generated_roadmap_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);
  `);

  const row = db.prepare('SELECT id FROM profile WHERE id = 1').get();
  if (!row) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO profile (id, name, profile_json, session_creations_json, created_at, updated_at)
      VALUES (1, 'Student', ?, '[]', ?, ?)
    `).run(JSON.stringify(DEFAULT_PROFILE), now, now);
  }

  migrateDropExtractedContext();
}

function connectDB() {
  ensureDataDir();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema();
  console.log(`✅ SQLite database ready at ${DB_PATH}`);
  return db;
}

function getDb() {
  if (!db) {
    connectDB();
  }
  return db;
}

function isHealthy() {
  try {
    getDb().prepare('SELECT 1 FROM profile WHERE id = 1').get();
    return true;
  } catch {
    return false;
  }
}

function rowToUser(row) {
  if (!row) return null;
  return {
    _id: 'local-user',
    id: 'local-user',
    name: row.name,
    email: 'local@askperi.app',
    profile: parseJson(row.profile_json, { ...DEFAULT_PROFILE }),
    sessionCreations: parseJson(row.session_creations_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getUser() {
  const row = getDb().prepare('SELECT * FROM profile WHERE id = 1').get();
  return rowToUser(row);
}

function updateUser(updates) {
  const current = getDb().prepare('SELECT * FROM profile WHERE id = 1').get();
  if (!current) return null;

  const user = rowToUser(current);
  const now = new Date().toISOString();

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.profile !== undefined) user.profile = { ...user.profile, ...updates.profile };
  if (updates.sessionCreations !== undefined) user.sessionCreations = updates.sessionCreations;

  getDb().prepare(`
    UPDATE profile
    SET name = ?, profile_json = ?, session_creations_json = ?, updated_at = ?
    WHERE id = 1
  `).run(
    user.name,
    JSON.stringify(user.profile),
    JSON.stringify(user.sessionCreations),
    now,
  );

  user.updatedAt = now;
  return user;
}

/** Flat profile object for AI calls, recommendations, and roadmap. */
function userToMergedProfile(user) {
  if (!user) return {};
  const prof = user.profile || {};
  return {
    name: user.name || null,
    gpa: prof.gpa ?? null,
    educationLevel: prof.educationLevel || null,
    targetDegree: prof.targetDegree || null,
    major: prof.major || null,
    residency: prof.residency || null,
    preferredCountries: prof.preferredCountries || [],
    maxBudget: prof.maxBudget ?? null,
    englishTest: prof.englishTest || { testType: 'None', score: null },
    workExperience: prof.workExperience ?? 0,
    researchExperience: prof.researchExperience ?? false,
    publications: prof.publications ?? 0,
    age: prof.age ?? null,
  };
}

function rowToSession(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: 'local-user',
    messages: parseJson(row.messages_json, []),
    isClosed: Boolean(row.is_closed),
    generatedRoadmap: parseJson(row.generated_roadmap_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getSessions(options = {}) {
  let sql = 'SELECT * FROM chat_sessions ORDER BY updated_at DESC';
  if (options.limit) {
    sql += ` LIMIT ${Number(options.limit)}`;
  }
  return getDb().prepare(sql).all().map(rowToSession);
}

function getSessionById(id) {
  const row = getDb().prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
  return rowToSession(row);
}

function createSession(data) {
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO chat_sessions (id, messages_json, is_closed, generated_roadmap_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    JSON.stringify(data.messages || []),
    data.isClosed ? 1 : 0,
    data.generatedRoadmap ? JSON.stringify(data.generatedRoadmap) : null,
    now,
    now,
  );

  return getSessionById(id);
}

function saveSession(session) {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE chat_sessions
    SET messages_json = ?, is_closed = ?, generated_roadmap_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    JSON.stringify(session.messages || []),
    session.isClosed ? 1 : 0,
    session.generatedRoadmap ? JSON.stringify(session.generatedRoadmap) : null,
    now,
    session._id || session.id,
  );
  session.updatedAt = now;
  return session;
}

function deleteSession(id) {
  const result = getDb().prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  connectDB,
  getDb,
  isHealthy,
  getUser,
  updateUser,
  userToMergedProfile,
  getSessions,
  getSessionById,
  createSession,
  saveSession,
  deleteSession,
  DEFAULT_PROFILE,
  DATA_DIR,
  DB_PATH,
};
