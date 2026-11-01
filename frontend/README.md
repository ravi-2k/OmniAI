# OmniAI Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4. A chat interface for the OmniAI multi-agent backend: Chat, Search, PDF, PPT, Coding and Vision agents, file uploads, downloadable results, and a sandboxed code/preview panel.

Related docs (project root): `BACKEND_AUDIT.md` (API contract, fixes) and `FRONTEND_PLAN.md` (design decisions).

## Run locally

Prerequisites: Node 22+ (developed on 24), the backend running (gateway on `http://localhost:8000`, with Redis and MongoDB).

```bash
cd frontend
cp .env.example .env      # then fill in the Firebase values (see below)
npm install
npm run dev               # http://localhost:5173
```

In development Vite proxies `/api` to the gateway, so the browser sees a single origin and the httpOnly session cookie works with no CORS setup.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | yes | Firebase web config (public by design; not a secret) |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes | Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | yes | Firebase web config |
| `VITE_FIREBASE_APP_ID` | yes | Firebase web config |
| `VITE_API_BASE` | no | Leave empty for same-origin (recommended). Set only if the API is on a different origin, which also needs CORS and cookie settings on the backend |
| `DEV_GATEWAY_URL` | no | Dev only: where the Vite proxy forwards `/api` (default `http://localhost:8000`) |

Only `VITE_*` values are included in the browser bundle. No backend secrets or Firebase Admin credentials are ever used here. Your Firebase project must have Google sign-in enabled and `localhost` (plus your production domain) in Authorized domains.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm test` | Vitest + Testing Library + MSW (88 tests) |

## Build and deploy

`npm run build` produces static files in `dist/`. Serve them from S3 + CloudFront (or any static host) **on the same origin as the API**: route `/api/*` to the gateway (ALB), and everything else to the static files, with `index.html` as the fallback for client-side routes (`/c/:id`). Same-origin means no CORS and the existing `strict` session cookie keeps working. Set `COOKIE_SECURE=true` on the backend (HTTPS).

Requirements on the infrastructure side:
- ALB / CloudFront origin timeout of at least **180 s**: AI responses are not streamed yet.
- The gateway and agent services read their secrets from the environment (see each service's `.env.example`).

## Architecture

```
src/
  config/        env + agent catalogue (UI agent -> backend agent mapping)
  types/         TypeScript mirror of the backend contract
  services/      api/ (client, endpoints, error mapping), auth/ (Firebase popup)
  contexts/      Auth, Theme, Toast, Sidebar, Artifacts, ChatSession
  hooks/         React Query hooks, file-URL refresh, speech recognition, utilities
  components/    ui/, layout/, sidebar/, chat/, messages/, composer/, artifacts/
  pages/         Login, Chat, NotFound
  utils/         preview builder (sandbox), file validation, dates, downloads
tests/           unit + component tests (MSW mocks the real API contract)
```

- **Auth:** the backend owns the session (httpOnly cookie). Firebase is used only to obtain an ID token at sign-in, then signed out client-side. On load the app calls `GET /api/user` to restore the session; any 401 clears all cached data and returns to login.
- **Server state:** TanStack Query for conversations and messages (pagination, caching, invalidation). Everything else is React context.
- **Sending a message:** the optimistic user bubble and an in-progress state live in `ChatSessionContext`; on success the server's saved messages replace them (no duplicates), on failure Retry is offered (the backend saves nothing on failure). A new chat creates its conversation on the first send.
- **Agents:** the UI offers Auto, Chat, Search, PDF, PPT, Coding, Vision. With an attachment, PDF/Vision work on the file; without one they generate. The reply shows which agent answered.
- **Heavy code is lazy-loaded:** CodeMirror (~86 kB gz), the Markdown renderer + highlighter (~103 kB gz) and the artifacts panel load on demand.

## Security notes

- Generated HTML is rendered in `<iframe sandbox="allow-scripts">` (no `allow-same-origin`), with an injected Content-Security-Policy that blocks network requests, forms and external scripts. Local CSS/JS files are inlined from the artifact. Third-party scripts from CDNs will not run in the preview.
- Markdown never renders raw HTML; `javascript:` links are dropped; external links use `rel="noopener noreferrer"`.
- Uploads are validated client-side (PDF, JPEG/PNG/WebP/GIF/HEIC, max 20 MB) but the backend remains the authority.
- Error messages shown to users come from a fixed mapping; backend internals are never displayed.
- All user-scoped caches are cleared on sign-out and on session expiry. Only theme, sidebar and panel width are kept in `localStorage`.

## Testing summary

- **88 automated tests, all passing**, with MSW in strict mode (any unexpected request fails a test): file validation, date grouping, agent mapping, error mapping, the preview/CSP builder (including script-breakout and external-script cases), API client (cookies, 401 handling, timeout, abort, multipart), auth and protected routes, session expiry, sign-out cache clearing, the chat flows (send, Enter/Shift+Enter, agent selection, new-chat creation, retry, rate limit, network failure, attachments, artifacts auto-open vs history), sidebar (grouping, search, rename, delete with confirmation), Markdown (code copy, citations, XSS cases), file cards (expired link refresh), artifact tabs (keyboard), and the artifact panel.
- `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) and ESLint are clean; the production build succeeds.
- **Verified manually against the real backend** (throwaway MongoDB/Redis, real LLM and search calls): login redirect, session restore after refresh, Auto routing to Chat, lazy conversation creation with automatic title, Coding agent with auto-opening panel and live sandboxed preview, code view, Search agent with sources and images, history reload, dark and light themes, mobile drawer and full-screen artifacts sheet.
- **Not verified end to end:** Google sign-in popup (cannot be automated; the backend exchange is tested), and anything that uses S3 or Qdrant: file upload, PDF/PPT/image generation and PDF Q&A, plus voice input (needs a real microphone). These paths are covered by component tests against the API contract, but need one manual run with your live credentials.

## Known limitations

- **No streaming:** replies appear when complete; the UI shows staged progress and a Stop button (stopping abandons the request; the server may still finish it).
- **No regenerate or message editing** (the backend has no endpoint). Failed sends can be retried.
- **PPT has no in-app preview** (download only); PDFs open in the browser viewer.
- **Voice input** uses the browser's Web Speech API: unavailable in Firefox; in Chrome audio goes to Google's speech service.
- **Preview** cannot run pages that load third-party scripts (blocked by CSP by design).
- `npm audit` reports advisories inside `firebase`'s unused Firestore dependency tree; this app only imports `firebase/auth`, so that code is not in the bundle.
- Deleting a chat does not yet remove its S3 files or Qdrant data (backend cleanup pending).
