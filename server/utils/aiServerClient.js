/**
 * Shared helpers for Node → FastAPI internal API calls.
 */

const getAiServerHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.AI_SERVER_SECRET || process.env.INTERNAL_API_KEY;
  if (secret) {
    headers['X-Internal-Api-Key'] = secret;
  }
  return headers;
};

const getAiServerUrl = () => process.env.AI_SERVER_URL || 'http://127.0.0.1:8000';

const summarizeSessionMemory = async (userId, sessionId, messages) => {
  if (!messages || messages.length === 0) return;

  try {
    const conversation = messages.map((m) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    }));

    const res = await fetch(`${getAiServerUrl()}/memory/summarize`, {
      method: 'POST',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        user_id: String(userId),
        session_id: String(sessionId),
        conversation,
      }),
    });

    if (!res.ok) {
      console.warn(`[Memory] Summarize returned status ${res.status}`);
    }
  } catch (err) {
    console.warn('[Memory] Failed to summarize session:', err.message);
  }
};

const deleteSessionMemory = async (userId, sessionId) => {
  const res = await fetch(`${getAiServerUrl()}/memory/${encodeURIComponent(userId)}/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: getAiServerHeaders(),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Memory delete returned status ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
};

module.exports = {
  getAiServerHeaders,
  getAiServerUrl,
  summarizeSessionMemory,
  deleteSessionMemory,
};
