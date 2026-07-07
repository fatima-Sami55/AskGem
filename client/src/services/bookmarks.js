const STORAGE_KEY = 'askperi_bookmarks';

const EMPTY = { universities: [], scholarships: [] };

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, universities: [], scholarships: [] };
    const parsed = JSON.parse(raw);
    return {
      universities: Array.isArray(parsed.universities) ? parsed.universities : [],
      scholarships: Array.isArray(parsed.scholarships) ? parsed.scholarships : [],
    };
  } catch {
    return { universities: [], scholarships: [] };
  }
}

function writeStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadBookmarks() {
  return readStore();
}

export function clearBookmarks() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isBookmarked(type, sourceUrl) {
  if (!sourceUrl) return false;
  const store = readStore();
  const list = type === 'scholarships' ? store.scholarships : store.universities;
  return list.some((b) => b.sourceUrl === sourceUrl);
}

export function toggleBookmark(type, item) {
  const store = readStore();
  const key = type === 'scholarships' ? 'scholarships' : 'universities';
  const list = store[key];
  const idx = list.findIndex((b) => b.sourceUrl === item.sourceUrl);

  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push({
      name: item.name,
      sourceUrl: item.sourceUrl,
      savedAt: new Date().toISOString(),
    });
  }

  writeStore(store);
  return list.some((b) => b.sourceUrl === item.sourceUrl);
}
