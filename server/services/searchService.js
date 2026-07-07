/**
 * server/services/searchService.js
 * Delegates web search execution to the central AskPeri Python AI Server.
 */
const { getAiServerHeaders, getAiServerUrl } = require('../utils/aiServerClient');

exports.search = async (query, maxResults = 5) => {
  try {
    const aiServerUrl = getAiServerUrl();
    const response = await fetch(`${aiServerUrl}/search`, {
      method: 'POST',
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ query, max_results: maxResults }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    }
    return [];
  } catch (err) {
    console.error('[Node SearchService] Failed to delegate search to AI server:', err.message);
    return [];
  }
};
