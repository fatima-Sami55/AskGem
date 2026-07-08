export const ASKPERI_STORAGE_PREFIX = 'askperi_';

const PENDING_CHAT_KEY = `${ASKPERI_STORAGE_PREFIX}pending_chat`;

/** Persist the latest user prompt while the server stream is still in flight (not saved to DB yet). */
export function savePendingChatMessage(sessionId, text) {
  if (!sessionId || !text?.trim()) return;
  try {
    const all = JSON.parse(localStorage.getItem(PENDING_CHAT_KEY) || '{}');
    all[sessionId] = { text: text.trim(), startedAt: Date.now() };
    localStorage.setItem(PENDING_CHAT_KEY, JSON.stringify(all));
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

export function getPendingChatMessage(sessionId) {
  if (!sessionId) return null;
  try {
    const all = JSON.parse(localStorage.getItem(PENDING_CHAT_KEY) || '{}');
    return all[sessionId] || null;
  } catch {
    return null;
  }
}

export function clearPendingChatMessage(sessionId) {
  if (!sessionId) return;
  try {
    const all = JSON.parse(localStorage.getItem(PENDING_CHAT_KEY) || '{}');
    delete all[sessionId];
    localStorage.setItem(PENDING_CHAT_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function sessionHasModelReplyAfter(messages, userContent) {
  const userIdx = messages.findIndex(
    (m) => m.role === 'user' && String(m.content) === String(userContent),
  );
  if (userIdx < 0) return false;
  return messages.slice(userIdx + 1).some(
    (m) => m.role === 'model' && String(m.content || '').trim(),
  );
}

/** Re-attach a user bubble after refresh if the server has not persisted it yet. */
export function restorePendingChatMessages(sessionId, messages, newMessageId) {
  const pending = getPendingChatMessage(sessionId);
  if (!pending?.text) return { messages, awaitingReply: false };

  const pendingText = pending.text.trim();
  const normalized = [...messages];
  const onServer = normalized.some(
    (m) => m.role === 'user' && String(m.content) === pendingText,
  );

  if (onServer) {
    if (sessionHasModelReplyAfter(normalized, pendingText)) {
      clearPendingChatMessage(sessionId);
      return { messages: normalized, awaitingReply: false };
    }
    return { messages: normalized, awaitingReply: true };
  }

  return {
    messages: [
      ...normalized,
      {
        id: newMessageId(),
        role: 'user',
        content: pendingText,
        timestamp: new Date(pending.startedAt || Date.now()),
      },
    ],
    awaitingReply: true,
  };
}

export function shouldClearPendingChatMessage(sessionId, messages) {
  const pending = getPendingChatMessage(sessionId);
  if (!pending?.text) return false;
  return sessionHasModelReplyAfter(messages, pending.text);
}

/** Remove every localStorage key prefixed with askperi_ (profile drafts, setup flag, bookmarks, etc.). */
export function clearAllAskperiLocalStorage() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ASKPERI_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
