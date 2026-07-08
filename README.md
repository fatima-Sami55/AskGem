# AskPeri — Local AI Education Advisor

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node 18+](https://img.shields.io/badge/Node-18+-green.svg)
![Local-first / Ollama](https://img.shields.io/badge/Local--first-Ollama-purple.svg)

AskPeri is a **single-user, local-only** education advisor for Pakistani and international students planning to study abroad. Chat with Peri, build an academic profile, explore university and scholarship matches, and generate a personalized application roadmap — all on your machine. No cloud accounts, no login, no external LLM APIs.

> **Formerly GenEduPlanner** — rebuilt as AskPeri: local-first, single-user, powered by Ollama.

> **⚠️ Always run `npm run dev` from the repo root.** Do NOT run only `cd server && npm run dev` — chat requires FastAPI on `:8000`.

See [RELEASE.md](RELEASE.md) for the v1.0.0 release checklist and tagging steps.

---

## What AskPeri Does

- **Chat advisor** — Peri runs on [Ollama](https://ollama.com) (default model: `gemma3:4b`) with optional web search
- **Profile & scoring** — CGPA, target degree, countries, budget, and English tests with heuristic profile strength
- **Universities & scholarships** — AI-assisted recommendations with honest match scoring (only when verifiable)
- **Roadmap** — Step-by-step timeline when your profile is complete
- **Privacy-first** — SQLite + Chroma on disk; search queries are generalized before leaving your machine

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Disk | 5 GB free | 10 GB free (includes model weights) |
| CPU | 4 cores | 8 cores |

**Software:** Node.js 18+, Python 3.10+, [Ollama](https://ollama.com)

### Honest Latency (CPU-only)

| Operation | Typical time (CPU-only) |
|-----------|-------------------------|
| Chat greeting (fast path) | Near-instant (~seconds) |
| Chat advice (substantive reply) | 2–5+ minutes |
| University / scholarship recommendations | 1–5 minutes (first load can take longer) |
| Roadmap generation | 2–10 minutes |

Times vary with model size, hardware, and query complexity. GPU acceleration via Ollama significantly improves these times.

---

## Quick Start

```bash
# 1. Install Ollama and pull the model
ollama pull gemma3:4b

# 2. Clone and install
git clone https://github.com/fatima-Sami55/AskPeri.git && cd AskPeri
npm run setup
npm run setup:ai

# 3. Copy environment files (if not auto-created on first dev run)
copy server\.env.example server\.env        # Windows
copy ai\.env.example ai\.env
# cp server/.env.example server/.env        # macOS/Linux
# cp ai/.env.example ai/.env

# 4. Start everything (from repo root)
npm run dev
```

Open **http://127.0.0.1:5173**

**First launch flow:** Setup screen (health check) → onboarding wizard (name, degree, country, GPA) → chat.

If Ollama or the model is missing, the **Setup Screen** blocks the app until checks pass.

**First install requires Python 3.10+.** Setup looks for Python on your PATH first, then checks common install locations automatically. If setup still can't find Python, reinstall it from [python.org](https://www.python.org/downloads/) and make sure **Add Python to PATH** is checked during install.

---

## npm Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run setup` | Install Node deps + create `./data/` |
| `npm run setup:ai` | Install Python deps in `ai/venv` |
| `npm run dev` | Start FastAPI + Express + Vite (full stack) |
| `npm run verify` | Pre-release stack check (Ollama, FastAPI, Express) |
| `npm run health` | Human-readable health report |
| `npm run smoke` | End-to-end API smoke test (requires `npm run dev`) |
| `npm run build` | Production build of React client → `client/dist` |
| `npm run start:prod` | Production: FastAPI + Express + static client on `:5000` |

**Release gate:** `npm run verify && npm run smoke && npm run build` must all pass before tagging.

Platform launchers (same as `npm run dev`): `npm run dev:win` · `npm run dev:unix`

---

## Production (single port)

```bash
npm run build
npm run start:prod
```

Open **http://127.0.0.1:5000** — API and UI on one port. FastAPI runs internally on `:8000`.

---

## Tavily (optional)

Better web search results. Without it, AskPeri uses DuckDuckGo with reduced quality.

1. Get a key at [tavily.com](https://tavily.com)
2. **Settings → paste key**, or set `TAVILY_API_KEY` in `ai/.env`:

```env
TAVILY_API_KEY=tvly-...
```

---

## Architecture

```
Browser (127.0.0.1:5173 dev · :5000 prod)
    ↓
Express API (127.0.0.1:5000)  ← SQLite (./data/askperi.db)
    ↓
FastAPI AI Server (127.0.0.1:8000)
    ↓
Ollama (127.0.0.1:11434) + ChromaDB (./data/chroma_data)
```

All services bind to **127.0.0.1 only**.

---

## Data Storage

| Data | Location |
|------|----------|
| Profile & chat sessions | `./data/askperi.db` |
| Tavily API key (optional) | `ai/.env` |
| Conversation memory vectors | `./data/chroma_data/` |
| Bookmarks | Browser `localStorage` (`askperi_bookmarks`) |

**Settings → Clear all data** resets profile, sessions, Chroma memory, bookmarks, and caches.

---

## Known limitations

- **University match percentages are AI-estimated, not verified.** When a match score for a university or scholarship comes from AI analysis rather than a direct source, it's marked "Unverified" — treat it as a rough guide, not a guarantee, and confirm details on the official university or scholarship site before relying on it.
- **Use one browser tab at a time.** AskPeri stores your profile and chat history locally and doesn't sync between tabs. If you have it open in two tabs, whichever one saves last will overwrite the other. Stick to a single tab per session to avoid losing data.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Health shows `ai={all false}` / FastAPI ❌ | FastAPI not running — run `npm run dev` from **repo root**, not `cd server` alone |
| `Cannot find module` | Run `npm install` in `server/` and `client/` |
| Ollama not running | Start with `ollama serve` |
| Model not found | Run `ollama pull gemma3:4b` |
| Port in use | Change `PORT` in `server/.env` (and Vite port in `client/vite.config.js` if needed) |
| Setup screen won't dismiss | Run `ollama pull gemma3:4b`; ensure `npm run dev` started full stack |
| Chat returns 503 | `npm run verify` or `npm run health` — check FastAPI :8000 |
| Slow chat / recommendations | Normal on CPU — see latency table above |
| Smoke "Send message skipped" | OK on CPU if `npm run verify` passed (120s timeout) |
| `better-sqlite3` install fails | Install [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) on Windows |
| Setup can't find Python | Reinstall Python 3.10+ from [python.org](https://www.python.org/downloads/) with **Add Python to PATH** checked, then run `npm run setup` again |
| Python venv issues | `cd ai && python -m venv venv && pip install -r requirements.txt` |

---

## Privacy

- All LLM inference runs locally via Ollama
- Web search sends generalized queries only (optional Tavily key)
- No telemetry, no cloud account
- You can export profile JSON or wipe all data from Settings

---

## License

MIT
