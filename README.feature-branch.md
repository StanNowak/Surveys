# Backend Experiment (feature/backend-experiment)

This branch adds a Dockerized Postgres + PostgREST backend and wires the runner to use it **only** in local dev. GitHub Pages/Netlify builds remain static (JSON download only).

## Local dev
1) `cd packages/backend && cp postgrest/.env.example postgrest/.env && docker compose up`
2) Serve `/public` (e.g., `npx http-server public -p 5173`)
3) Open `http://localhost:5173/?uuid=dev-1` → backend is auto-enabled via `env.local.js`
4) Run `make -C studies/ap_v1 smoke` to test RPC endpoints.

## Static deploy safety
- `public/env.js` leaves ASSIGN_URL/SAVE_URL empty and `MODE="test"`.
- `public/env.local.js` loads only on localhost to flip backend on.

## Notes
- Keep PII out of payloads; store only UUID + answers.
- For production, host backend in EU and set CORS allowlist to your survey origin.
