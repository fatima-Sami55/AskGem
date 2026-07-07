const { getAiServerHeaders, getAiServerUrl } = require('../utils/aiServerClient');

const RECOMMENDATIONS_TIMEOUT_MS = Number(process.env.RECOMMENDATIONS_TIMEOUT_MS) || 600000;
const CACHE_TTL_MS = Number(process.env.RECOMMENDATIONS_CACHE_TTL_MS) || 60 * 60 * 1000;

/** @type {Map<string, { data: object, expiresAt: number }>} */
const recommendationsCache = new Map();
/** @type {Map<string, Promise<object>>} */
const inflightRequests = new Map();

function buildProfilePayload(merged) {
  return {
    name: merged.name || null,
    nationality: String(merged.residency || 'Pakistani'),
    current_degree: merged.educationLevel ? String(merged.educationLevel) : '',
    target_degree: merged.targetDegree || null,
    cgpa: merged.gpa !== null && merged.gpa !== undefined ? Number(merged.gpa) : null,
    preferred_countries: Array.isArray(merged.preferredCountries) ? merged.preferredCountries : [],
    preferred_majors: merged.major ? [String(merged.major)] : [],
    budget: merged.maxBudget !== null && merged.maxBudget !== undefined ? Number(merged.maxBudget) : null,
    english_test: merged.englishTest?.testType ? {
      testType: String(merged.englishTest.testType),
      score: merged.englishTest.score !== null && merged.englishTest.score !== undefined
        ? Number(merged.englishTest.score) : null,
    } : {},
    work_experience: merged.workExperience !== null && merged.workExperience !== undefined
      ? Number(merged.workExperience) : 0,
    research_experience: merged.researchExperience || false,
    publications: merged.publications || 0,
  };
}

function buildCacheKey(userId, merged, type) {
  const countries = (merged.preferredCountries || []).slice().sort().join(',');
  return [
    userId || 'anon',
    type,
    merged.targetDegree || '',
    merged.major || '',
    countries,
    merged.gpa ?? '',
    merged.residency || '',
  ].join('|');
}

function getCached(key, type) {
  const entry = recommendationsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    recommendationsCache.delete(key);
    return null;
  }
  if (!hasRecommendations(entry.data, type)) {
    recommendationsCache.delete(key);
    return null;
  }
  return { ...entry.data, source: 'cache' };
}

function hasRecommendations(data, type) {
  if (type === 'universities') return (data?.universities || []).length > 0;
  if (type === 'scholarships') return (data?.scholarships || []).length > 0;
  return false;
}

function setCache(key, data) {
  recommendationsCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchRecommendations(path, mergedProfile) {
  const aiServerUrl = getAiServerUrl();
  const aiResponse = await fetch(`${aiServerUrl}${path}`, {
    method: 'POST',
    headers: getAiServerHeaders(),
    signal: AbortSignal.timeout(RECOMMENDATIONS_TIMEOUT_MS),
    body: JSON.stringify({ profile: buildProfilePayload(mergedProfile) }),
  });

  if (!aiResponse.ok) {
    throw new Error(`AI Server returned status ${aiResponse.status}`);
  }

  return aiResponse.json();
}

async function getOrFetchRecommendations(userId, mergedProfile, type, path, { forceRefresh = false } = {}) {
  const cacheKey = buildCacheKey(userId, mergedProfile, type);
  if (forceRefresh) {
    recommendationsCache.delete(cacheKey);
  }
  const cached = getCached(cacheKey, type);
  if (cached) {
    return cached;
  }

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const promise = fetchRecommendations(path, mergedProfile)
    .then((data) => {
      if (hasRecommendations(data, type)) {
        setCache(cacheKey, data);
      }
      return data;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, promise);
  return promise;
}

exports.getUniversityRecommendations = async (userId, mergedProfile, options = {}) => {
  return getOrFetchRecommendations(
    userId,
    mergedProfile,
    'universities',
    '/recommendations/universities',
    options,
  );
};

exports.getScholarshipRecommendations = async (userId, mergedProfile, options = {}) => {
  return getOrFetchRecommendations(
    userId,
    mergedProfile,
    'scholarships',
    '/recommendations/scholarships',
    options,
  );
};
