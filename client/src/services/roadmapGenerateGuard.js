/** Prevents duplicate roadmap auto-generation across React Strict Mode remounts. */

const attemptedSessions = new Set();
const inflightSessions = new Set();

export function shouldAttemptRoadmapGeneration(sessionId) {
  if (!sessionId) return false;
  if (attemptedSessions.has(sessionId) || inflightSessions.has(sessionId)) {
    return false;
  }
  return true;
}

export function markRoadmapGenerationStarted(sessionId) {
  if (sessionId) inflightSessions.add(sessionId);
}

export function markRoadmapGenerationFinished(sessionId, succeeded = true) {
  if (!sessionId) return;
  inflightSessions.delete(sessionId);
  if (succeeded) {
    attemptedSessions.add(sessionId);
  }
}
