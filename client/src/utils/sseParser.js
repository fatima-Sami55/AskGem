/**
 * Parse Server-Sent Event chunks from a text buffer.
 * Returns complete events and leaves any trailing partial event in the buffer.
 */
export function parseSseBuffer(buffer, onEvent) {
  const events = buffer.split('\n\n');
  const remainder = events.pop() ?? '';

  for (const evt of events) {
    const trimmed = evt.trim();
    if (!trimmed.startsWith('data: ')) continue;
    const rawVal = trimmed.slice(6).trim();
    if (!rawVal) continue;
    onEvent(rawVal);
  }

  return remainder;
}

export function parseSsePayload(rawVal) {
  if (rawVal === '[DONE]') {
    return { type: 'done' };
  }

  try {
    const parsed = JSON.parse(rawVal);
    if (parsed.type === 'error') {
      return { type: 'error', message: parsed.message || 'AI service unavailable' };
    }
    if (parsed.type === 'pending_extraction') {
      return { type: 'pending_extraction', data: parsed };
    }
    if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
      return { type: 'sources', sources: parsed.sources };
    }
    if (parsed.type === 'status') {
      return { type: 'status', phase: parsed.phase, message: parsed.message };
    }
    if (parsed.chunk !== undefined) {
      return {
        type: 'chunk',
        text: String(parsed.chunk).replace(/\\n/g, '\n'),
      };
    }
    return { type: 'unknown', raw: parsed };
  } catch {
    return { type: 'chunk', text: rawVal.replace(/\\n/g, '\n') };
  }
}
