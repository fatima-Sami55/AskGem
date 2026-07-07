/** In-memory cache for recommendation API calls. Only caches non-empty successful responses. */

const cache = new Map();
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeRecommendationsCache(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecommendationsCacheKey(type, sessionId) {
  return `${type}:${sessionId ?? '__profile__'}`;
}

function getItemCount(key, res) {
  const type = key.split(':')[0];
  const data = res?.data?.data || {};
  const items = type === 'scholarships' ? data.scholarships : data.universities;
  return Array.isArray(items) ? items.length : 0;
}

function isCacheable(key, res) {
  return getItemCount(key, res) > 0;
}

export function getCachedEntry(key) {
  return cache.get(key) || null;
}

export function getCacheAgeMinutes(key) {
  const entry = cache.get(key);
  if (!entry?.cachedAt) return null;
  return Math.max(0, Math.floor((Date.now() - entry.cachedAt) / 60000));
}

export async function fetchRecommendationsCached(key, fetchFn, { forceRefresh = false } = {}) {
  if (!forceRefresh && cache.has(key)) {
    const cached = cache.get(key);
    if (isCacheable(key, cached.response)) {
      return cached.response;
    }
    cache.delete(key);
  }

  const data = await fetchFn();
  if (isCacheable(key, data)) {
    cache.set(key, { response: data, cachedAt: Date.now() });
  }
  return data;
}

export function clearRecommendationsCache(type) {
  if (!type) {
    cache.clear();
  } else {
    for (const key of [...cache.keys()]) {
      if (key.startsWith(`${type}:`)) {
        cache.delete(key);
      }
    }
  }
  notifyListeners();
}

export function invalidateRecommendationsCache() {
  clearRecommendationsCache();
}
