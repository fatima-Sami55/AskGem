# Contributing to AskPeri

Thank you for your interest in AskPeri! Pull requests are welcome.

## Before opening a PR

1. Run the full stack from the **repo root** (not `server/` alone):

   ```bash
   npm run dev
   ```

2. Run the release gate checks:

   ```bash
   npm run verify && npm run smoke
   ```

3. If you changed the client, confirm the build still passes:

   ```bash
   npm run build
   ```

## Development notes

- Always start services with `npm run dev` from the repo root — chat requires FastAPI on `:8000`.
- Do not commit `.env` files, `data/`, `client/dist/`, or Chroma/venv directories.
- Keep changes focused; AskPeri is a single-user local app (no auth, no cloud LLM, no MongoDB).

## Questions

Open a GitHub issue for bugs, feature ideas, or setup help.
