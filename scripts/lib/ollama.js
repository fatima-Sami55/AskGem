const { OLLAMA_URL, OLLAMA_MODEL } = require('./config');

async function fetchOllamaTags(timeoutMs = 10000) {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Ollama returned HTTP ${res.status}`);
  }
  return res.json();
}

function modelInTags(tagsBody, modelName = OLLAMA_MODEL) {
  const models = tagsBody?.models || [];
  return models.some((m) => {
    const name = m.name || '';
    return name === modelName || name.startsWith(`${modelName}:`) || name.split(':')[0] === modelName.split(':')[0];
  });
}

async function checkOllamaModel(modelName = OLLAMA_MODEL) {
  try {
    const tags = await fetchOllamaTags();
    const present = modelInTags(tags, modelName);
    return { ok: true, reachable: true, modelPresent: present, modelName };
  } catch (err) {
    const unreachable = err.name === 'TimeoutError' || err.name === 'AbortError'
      || err.cause?.code === 'ECONNREFUSED'
      || String(err.message).includes('ECONNREFUSED')
      || String(err.message).includes('fetch failed');
    return {
      ok: false,
      reachable: !unreachable,
      modelPresent: false,
      modelName,
      error: err.message,
    };
  }
}

module.exports = {
  fetchOllamaTags,
  modelInTags,
  checkOllamaModel,
};
