const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'askperi-settings-test-'));
process.env.DATA_DIR = testDataDir;
process.env.NODE_ENV = 'test';

const AI_ENV_PATH = path.resolve(__dirname, '..', '..', 'ai', '.env');
const {
  CLEAR_ALL_CONFIRM_HEADER,
  CLEAR_ALL_CONFIRM_VALUE,
} = require('../middleware/clearAllGuard');

let app;
let originalFetch;
let originalAiEnvContent = null;
let aiEnvExisted = false;

function collectJsonKeys(value, keys = new Set()) {
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectJsonKeys(nested, keys);
    }
  }
  return keys;
}

describe('settings routes — security regressions', () => {
  beforeAll(() => {
    const { connectDB } = require('../db');
    connectDB();
    app = require('../server');

    originalFetch = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      }),
    );

    aiEnvExisted = fs.existsSync(AI_ENV_PATH);
    if (aiEnvExisted) {
      originalAiEnvContent = fs.readFileSync(AI_ENV_PATH, 'utf8');
    }
    fs.mkdirSync(path.dirname(AI_ENV_PATH), { recursive: true });
    fs.writeFileSync(AI_ENV_PATH, '# test\nTAVILY_API_KEY=\n', 'utf8');
  });

  afterAll(() => {
    global.fetch = originalFetch;

    try {
      const { getDb } = require('../db');
      getDb().close();
    } catch {
      /* db may not be open */
    }

    if (aiEnvExisted && originalAiEnvContent !== null) {
      fs.writeFileSync(AI_ENV_PATH, originalAiEnvContent, 'utf8');
    } else if (!aiEnvExisted && fs.existsSync(AI_ENV_PATH)) {
      fs.unlinkSync(AI_ENV_PATH);
    }

    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  describe('GET /api/v1/settings — Tavily key masking', () => {
    it('never returns tavilyApiKey or any plaintext Tavily key field', async () => {
      const res = await request(app).get('/api/v1/settings').expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();

      const keys = collectJsonKeys(res.body);
      expect(keys.has('tavilyApiKey')).toBe(false);
      expect(keys.has('TAVILY_API_KEY')).toBe(false);

      expect(res.body.data).toHaveProperty('tavilyMasked');
      expect(res.body.data).toHaveProperty('tavilySource');
      expect(res.body.data).toHaveProperty('tavilyConfigured');

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toMatch(/tvly-[A-Za-z0-9]{10,}/);
    });
  });

  describe('POST /api/v1/settings/clear-all — confirm header guard', () => {
    it('returns 403 without X-AskPeri-Confirm header', async () => {
      const res = await request(app)
        .post('/api/v1/settings/clear-all')
        .send({})
        .expect(403);

      expect(res.body.message).toMatch(/confirmation/i);
    });

    it('succeeds with the correct X-AskPeri-Confirm header', async () => {
      const res = await request(app)
        .post('/api/v1/settings/clear-all')
        .set(CLEAR_ALL_CONFIRM_HEADER, CLEAR_ALL_CONFIRM_VALUE)
        .send({})
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toMatch(/cleared/i);
    });
  });
});
