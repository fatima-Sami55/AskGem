# AskPeri Releases

**Repository:** https://github.com/fatima-Sami55/AskPeri.git

This file documents published releases and the maintainer checklist for future versions. For install and usage, see [README.md](README.md).

---

## v1.0.0 — Local single-user release

**Tag:** `v1.0.0` · **Date:** July 2026

First public release of AskPeri — a single-user, local-only education advisor for international university admissions. Formerly **GenEduPlanner**, rebuilt as a privacy-first local app powered by Ollama.

### Requirements

- Node.js 18+, Python 3.10+, [Ollama](https://ollama.com)
- Model: `gemma3:4b` (`ollama pull gemma3:4b`)
- Optional: Tavily API key for better web search
- No cloud account, MongoDB, or OAuth required

### Quick start

```bash
ollama pull gemma3:4b
git clone https://github.com/fatima-Sami55/AskPeri.git
cd AskPeri
npm run setup
npm run setup:ai
```

Copy environment files (Windows):

```bash
copy server\.env.example server\.env
copy ai\.env.example ai\.env
```

macOS/Linux:

```bash
cp server/.env.example server/.env
cp ai/.env.example ai/.env
```

Start the full stack **from the repo root**:

```bash
npm run dev
```

Open **http://127.0.0.1:5173**

Production (single port):

```bash
npm run build
npm run start:prod
```

Open **http://127.0.0.1:5000**

### Highlights

- All AI inference runs locally via Ollama — no cloud LLM APIs
- SQLite profile storage with safe extraction and conflict confirmation
- Honest university/scholarship match scores (no fabricated percentages)
- Unified dev/prod launchers with `verify`, `health`, and `smoke` scripts
- Roadmap PDF export, onboarding wizard, optional Tavily search

### System requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Disk | 5 GB (includes model) | 10 GB |
| GPU | Optional | NVIDIA 6GB+ VRAM speeds inference |

### Known limitations

- CPU inference: 30–120s per chat turn; 2–10 min for roadmap/recommendations
- Single Ollama job at a time (queue lock)
- DuckDuckGo fallback is lower quality than Tavily
- Bookmarks stored in browser `localStorage` only
- Smoke test may skip "Send message" on slow CPU after 120s — not a failure if `npm run verify` passed

---

## For maintainers

Use this checklist before tagging a new release.

### Pre-release checklist

Run with the full stack up (`npm run dev` from repo root):

- [ ] `ollama pull gemma3:4b`
- [ ] `npm run dev` (FastAPI + Express + Vite from repo root)
- [ ] `npm run verify`
- [ ] `npm run health`
- [ ] `npm run smoke`
- [ ] `npm run build`
- [ ] `npm run start:prod` → open http://127.0.0.1:5000 → send "Hi" in chat
- [ ] Fresh clone test on a clean machine (or document known gaps)
- [ ] README install steps verified
- [ ] No secrets committed (`.env` gitignored, grep for keys)
- [ ] `data/`, `client/dist/`, `ai/venv/`, `ai/chroma_data/` not tracked

**Release gate:**

```bash
npm run verify && npm run smoke && npm run build
```

All three must exit 0.

### Tag and push

```bash
git tag -a vX.Y.Z -m "AskPeri vX.Y.Z — short description"
git push origin main
git push origin vX.Y.Z
```

### GitHub release

1. Open **Releases → Draft a new release** on GitHub
2. Select the tag (e.g. `v1.0.0`)
3. Title: `AskPeri vX.Y.Z — short description`
4. Copy the **Quick start**, **Highlights**, and **Known limitations** sections from this file into the release notes (user-facing — not the unchecked checklist)
5. Publish release

If [GitHub CLI](https://cli.github.com/) is installed:

```bash
gh release create vX.Y.Z --title "AskPeri vX.Y.Z" --notes-file RELEASE_NOTES.md
```

### Security audit (before commit)

- Confirm `.env`, `data/`, `client/dist/`, `ai/venv/`, `ai/chroma_data/` are not tracked
- `git rm --cached` any accidentally staged secrets or local data
- Grep source for hardcoded API keys, MongoDB URIs, JWT secrets (exclude `*.env.example`)
