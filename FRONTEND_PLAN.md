# OmniAI Frontend: Architecture & Implementation Plan

Status: **proposal for approval. No frontend code has been written.**
Backend contract referenced: `BACKEND_AUDIT.md` (section 2 endpoints, section 9 fixes and contract changes).

## 0. Decisions taken (your "use defaults" answers)

| # | Decision |
|---|---|
| Backend fixes | Done (see audit section 9). Regenerate is **not** offered because the backend has no such endpoint. |
| Streaming | **Later.** v1 shows staged progress and supports cancel. The API layer is isolated so SSE can be added without touching components. |
| Auth | Cookie session (backend). Firebase is used only to obtain an ID token at login. |
| Hosting / origin | **Same origin**: the static app and `/api/*` are served from one domain (CloudFront or ALB path routing, `/api/*` to the gateway). No CORS, no cross-site cookie problems. In dev, Vite proxies `/api` to the gateway. |
| Agents | Auto, Chat, Search, PDF, PPT, Coding, Vision (UI names). Mapped to backend values in section 5. The UI shows the agent Auto actually chose. |
| Voice | Browser Web Speech API. Mic button is hidden or disabled with an explanation when unsupported (Firefox). |
| Themes | Light and dark, default follows the system, persisted. |
| Brand | I propose one (section 9). Swap in a real logo anytime. |
| Artifacts | Read-only code viewer, ZIP download of all files. |
| Titles | Backend auto-titles on the first message; the user can rename. |
| Tooling | Convert the existing `frontend/` scaffold in place to TypeScript + Tailwind. Vitest + React Testing Library. CodeMirror 6 (not Monaco). |
| New chat | Clicking **New Chat** opens an empty conversation screen. The backend conversation is created on the **first send**, so abandoned chats don't litter "Recents" with empty "New Chat" rows. (One-line change if you'd rather create immediately.) |
| Firebase Analytics | Removed (extra bundle, privacy, not requested). |

`frontend-design` skill: it is **not** among the skills available here, and I will not install unverified skills. I'll follow the design direction in section 9 and the `artifact-design`-style principles (tokens, theming, restraint) instead.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite (existing) + React 19 + TS strict | Already in the scaffold. |
| Styling | Tailwind CSS v4 + CSS variable tokens | Theming via variables. *Verify the Tailwind Vite plugin supports the installed Vite 8 at install time; fall back to the PostCSS plugin if not.* |
| Routing | React Router | `/login`, `/`, `/c/:conversationId`. |
| Server state | **TanStack Query** | The one addition beyond your list. Conversations and messages are server data needing caching, pagination, invalidation, optimistic updates and request dedupe; hand-rolling this is more code and more bugs. UI state stays in plain React context. |
| UI state | React context (auth, theme, sidebar, artifacts) | No Redux/Zustand. |
| Primitives | Radix (Dialog, DropdownMenu, Popover, Tooltip) | Accessible dialogs/menus/focus management without writing them. |
| Icons / motion | lucide-react, `motion` | As requested. |
| Markdown | react-markdown + remark-gfm + rehype-highlight | No raw HTML rendering (safe by default). Math is omitted unless you want it. |
| Code viewer | CodeMirror 6 (lazy) | Much smaller than Monaco; read-only is a first-class mode. |
| ZIP | fflate (lazy) | Tiny. |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` | Self-hosted, no third-party requests. |
| Auth SDK | firebase (existing) | Google sign-in only. |
| Tests | Vitest, React Testing Library, MSW | MSW mocks the real API contract. |

Everything heavy (CodeMirror, highlighter, fflate, the artifacts panel) is code-split and loaded on demand.

## 2. Folder structure

```
frontend/
  .env.example                 VITE_FIREBASE_*, VITE_API_BASE (default "" = same origin)
  vite.config.ts               /api proxy -> gateway, chunking
  src/
    main.tsx  App.tsx  routes.tsx
    config/        env.ts (validated env), agents.ts (agent catalogue)
    types/         api.ts (backend contracts), domain.ts
    services/
      api/         client.ts (fetch + XHR upload), errors.ts, auth.api.ts, conversations.api.ts,
                   messages.api.ts, agent.api.ts, files.api.ts
      auth/        firebase.ts (Google sign-in helper)
    hooks/         useAuth, useConversations, useMessages, useSendMessage, useFileUrl,
                   useSpeechRecognition, useMediaQuery, useAutoResizeTextarea
    contexts/      AuthContext, ThemeContext, SidebarContext, ArtifactContext
    components/
      ui/          Button, IconButton, Dialog, Menu, Tooltip, Skeleton, Toast, Avatar, Spinner
      layout/      AppShell, ProtectedRoute, ErrorBoundary
      sidebar/     Sidebar, ConversationList, ConversationItem, ConversationSearch, UserMenu
      chat/        ChatView, ChatHeader, MessageList, EmptyState, ScrollToBottom
      messages/    UserMessage, AssistantMessage, Markdown, CodeBlock, SourceCards,
                   FileCard, ImageViewer, MessageActions, ArtifactCard, ErrorMessage
      composer/    Composer, AgentSelector, AttachmentChip, VoiceButton, SendButton
      artifacts/   ArtifactPanel (lazy), FileTabs, CodeViewer (lazy), PreviewFrame, ArtifactActions
    pages/         LoginPage, ChatPage, NotFoundPage
    utils/         date grouping, file validation, buildPreviewDoc, zip, format
    styles/        tokens.css, base.css
  tests/           setup, msw handlers
```

## 3. Routing and auth

- `/login` (public). `/` and `/c/:conversationId` sit behind `ProtectedRoute`.
- **Boot:** call `GET /api/user`. 200 means signed in; 401 means redirect to `/login`. While pending, show a branded splash (no flash of the wrong page).
- **Login:** Firebase `signInWithPopup(Google)` -> ID token -> `POST /api/auth/login {token}` -> backend sets the httpOnly cookie -> immediately `signOut` the Firebase client so there is a single source of truth for the session. Popup-blocked, cancelled and network errors have distinct messages.
- **Expiry:** the API client turns any 401 into a global "session ended" event: clear the query cache and user state, redirect to `/login`, and remember the intended URL to return to.
- **Logout:** `POST /api/auth/logout`, then clear all cached data (no cross-user leakage).
- Tokens are never stored in the browser; the cookie is httpOnly. Firebase web config moves to `VITE_` variables (it is public by design, but shouldn't be hardcoded).

## 4. API layer

- `client.ts`: `fetch` with `credentials: "include"`, JSON helpers, per-request `AbortSignal`, default timeout (30 s; 190 s for chat, slightly above the gateway's 180 s).
- Errors normalised to `ApiError { status, code, message, retryAfter? }` matching `{success:false, code, message}`. Network failures and timeouts become `NETWORK_ERROR` / `TIMEOUT`. User-facing text is mapped from `code`; raw messages are never trusted for markup.
- **Chat send uses XHR** (not fetch) to get upload progress and abort for files up to 20 MB.
- All request/response types live in `types/api.ts`, mirroring the real backend (including `files[]`, `sources[]`, `attachments[]`, `userMessage`, `assistantMessage`).
- No mock data in production code. MSW is test-only.

Endpoints used: `POST /api/auth/login|logout`, `GET /api/user`, `GET|POST /api/chat/create-conversation`, `GET /api/chat/get-conversation?limit&before&q`, `GET /api/chat/conversation/:id`, `POST /api/chat/update-conversation`, `DELETE /api/chat/delete-conversation/:id`, `GET /api/chat/get-messages/:id?limit&before`, `POST /api/chat/feedback`, `POST /api/agent/chat`, `GET /api/agent/file-url`.

## 5. Agents (UI -> backend)

| UI agent | Sent as `agent` | Notes |
|---|---|---|
| Auto (default) | `auto` | Response `agent` tells which one ran; shown as a small badge on the reply. |
| Chat | `chat` | |
| Search | `search` | Renders `sources[]` as cards and turns `[n]` citations into links. |
| PDF | `pdf` | No file -> generate a PDF. PDF attached -> answer questions about it. Placeholder text changes accordingly. |
| PPT | `ppt` | Generates a `.pptx` (download only; no preview exists). |
| Coding | `coding` | `artifacts[]` opens the panel; otherwise Markdown. |
| Vision | `vision` | No image -> generate an image. Image attached -> analyse it. |

Follow-up questions about an already-uploaded PDF: with PDF selected and no new file, send `pdfRag`. The composer shows "Using the PDF from this chat" when the conversation has a PDF attachment. Attachment rules in the UI: PDF or JPEG/PNG/WebP/GIF/HEIC, max 20 MB, one file per message. Agent/file combinations the backend can't serve are prevented in the UI rather than failing after upload.

Rate limits (429): a toast and an inline message with a countdown from `retryAfter`; the send button re-enables when it ends.

## 6. Chat data flow

- **Sidebar:** infinite query over conversations (50 per page, `before` = oldest `updatedAt`); debounced server search via `q`; groups Today / Yesterday / Previous 7 days / Older from real `updatedAt`. Rename inline (`update-conversation`), delete behind a confirm dialog. Skeletons, empty state, error + retry.
- **Messages:** infinite query, newest page first, "Load earlier messages" via `before`; the backend already returns oldest -> newest.
- **Send** (all keyed to one conversation id):
  1. If no conversation yet: `create-conversation`, then `navigate(/c/:id, replace)`.
  2. Optimistically add the user bubble (client `tempId`, attachment preview from the local file) and an assistant "working" placeholder with staged text (Thinking -> Searching / Writing code / Generating file, based on the chosen agent).
  3. `POST /api/agent/chat`. On success, replace both with `userMessage` / `assistantMessage` by id (no duplicates); update the sidebar (move the conversation to top, new title) from the response plus a list refetch.
  4. On failure, keep the user bubble, show an inline error with **Retry** (the backend saves nothing on failure, so retry is safe). On user cancel (abort), refetch messages once to reconcile in case the server finished anyway.
- One in-flight send per conversation; the send button is locked while sending; Enter-to-send is debounced against double submit.
- Switching conversations aborts nothing that's already saved; query keys are per conversation, so state never leaks between chats.
- Message actions: copy, thumbs up/down (`/feedback`), timestamps from `createdAt`. No regenerate button (backend lacks it); failed sends have Retry.

## 7. Files, images, sources

- `files[]` -> **FileCard** (icon by type, name, size, Download via `downloadUrl`; PDFs also get Preview in a new tab via `url`; images render inline with a lightbox; PPT is download-only).
- URLs expire: cards use the URL from the live response while `expiresAt` is in the future; otherwise (history, reload) they fetch a fresh one with `GET /api/agent/file-url?key=&name=` on first view or click. Failed downloads show a retry toast.
- User `attachments[]` show as chips/thumbnails the same way.
- Search: `sources[]` -> compact source cards (title, domain, snippet) plus a "Sources" row; `images[]` -> a small gallery.
- External links open with `rel="noopener noreferrer"` and an external-link icon.

## 8. Artifacts panel

- **Open rule:** auto-opens only when a **live** response contains `artifacts.length > 0` (Coding agent). When loading history, messages with artifacts show an **ArtifactCard** ("Open project, N files"); nothing auto-opens on page load.
- State is stored per conversation (`ArtifactContext` keyed by conversation id + artifact id), so artifacts never bleed between chats. Switching conversations closes or restores that conversation's panel.
- Layout: right drawer on desktop (resizable, remembers width), full-screen sheet on mobile. Motion slide-in; content lazy-loaded.
- File tabs (name + extension, truncation with tooltip, active highlight, keyboard navigable). Language comes from the backend's per-file `language`.
- CodeMirror 6 in read-only mode, line numbers, theme-aware. Actions: copy file, download file, download all as ZIP (fflate).
- **Code / Preview tabs** appear when the artifact has an HTML entry (`entry`). Preview details:
  - A sandboxed `<iframe sandbox="allow-scripts">` (no `allow-same-origin`, so the content cannot touch the app's cookies, storage or DOM) with `srcdoc`.
  - The doc is assembled client-side: local `<link rel="stylesheet" href="style.css">` and `<script src="script.js">` are inlined from the artifact's files; a CSP `<meta>` limits it to inline script/style and `https:` images/fonts, with no network `connect-src`, no forms to outside, no top navigation.
  - Responsive width toggle (desktop/tablet/mobile), refresh button, error overlay if the document fails to render.
  - Known limit: generated pages that load third-party scripts from CDNs won't run in the preview (blocked by CSP by design). The generator defaults to plain HTML/CSS/JS, so this should be rare.
- Non-HTML projects (React, Python...) are viewable as code only; the Preview tab is not shown rather than shown broken.

## 9. Design system

- **Direction:** quiet, editorial, product-grade. Generous whitespace, one accent, hairline borders, almost no shadows, motion only where it explains something.
- **Palette (tokens; both themes):** cool slate neutrals (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`), warm off-white in light and deep ink in dark; a single accent, **verdigris teal** (calm, distinct from the usual purple "AI" look), plus semantic success / warning / danger. Contrast checked to WCAG AA in both themes. No decorative gradients; at most a faint accent glow on the empty state.
- **Type:** Inter variable for UI, JetBrains Mono for code; 15-16 px message text at ~1.65 line height, max reading width ~72 ch.
- **Logo:** a simple SVG mark (a ring with one orbiting node, "omni") plus wordmark; replaceable.
- **Motion:** sidebar collapse, popover/dropdown, message entrance, artifact drawer, skeleton shimmer. Respects `prefers-reduced-motion`.
- **Responsive:** sidebar becomes a drawer below `lg`; composer stays pinned and keyboard-safe on mobile; artifacts become full-screen below `lg`; messages use full width on small screens.
- **Accessibility:** semantic landmarks, visible focus rings, Radix-managed focus trapping, `aria-live` region for "generating / done / error", keyboard-operable agent selector (listbox), tooltips on icon-only controls, labelled controls.
- **Empty state:** "What would you like to create today?" with six interactive suggestion chips (explain, search, PDF, PPT, code, analyse image) that prefill the composer and preselect the matching agent.

## 10. Error, loading, edge cases

Global `ErrorBoundary` plus per-region boundaries (the artifacts panel failing must not blank the chat). Offline detection banner. Skeletons for sidebar and messages. Handled explicitly: 401 mid-session, 429, 413/415 and size errors (pre-validated and server-confirmed), empty AI response (502 `EMPTY_RESPONSE`), timeouts, network drop during send, rapid conversation switching, missing avatar (initials fallback), invalid or empty artifact data (card shows a clear error instead of crashing), mic permission denied or unsupported browser. Internal error text is never shown; messages are mapped from error `code`.

## 11. Voice input

`SpeechRecognition` / `webkitSpeechRecognition`: start/stop, elapsed timer, cancel (discards), interim text streamed into the composer so the user can edit before sending. Handles permission denial and unsupported browsers (button hidden with an explanatory tooltip). Mic tracks and listeners are cleaned up on unmount. Privacy note: in Chrome the browser sends audio to its own speech service; documented in the README. A backend transcription endpoint would be the alternative if you need uniform behaviour.

## 12. Security

No secrets in the bundle (only public Firebase web config). Markdown renders without raw HTML. Previews are sandboxed with a CSP and no same-origin access. External links use `noopener noreferrer`. Uploads are validated client-side (type/size) but the backend remains the authority. The query cache and all user state are cleared on logout and on 401. No sensitive content in `localStorage` (only theme, sidebar state, panel width). Logging avoids user content.

## 13. Performance

Route-level lazy loading; dynamic imports for the artifacts panel, CodeMirror, highlighter and fflate. Memoised message items (stable ids) so a new message doesn't re-render history. Paged messages. Windowed rendering only if real conversations prove long enough to need it (revisit after testing, not upfront). Images sized with `loading="lazy"` and reserved aspect ratios.

## 14. Testing

- **Unit:** file validation, date grouping, preview document builder (including CSP and inlining), error mapping, ZIP naming.
- **Component (RTL + MSW against the real contract):** login flow, protected routes, sidebar (list/search/rename/delete), send success/failure/retry/429/abort, agent selector keyboard use, attachment add/remove/invalid, FileCard refresh-on-expiry, artifact auto-open vs history card, tab switching, copy actions.
- **Manual checklist** (documented): real Google sign-in, each agent against the live backend, voice in Chrome, mobile layouts, light/dark. Google sign-in and live LLM calls can't be automated here.
- Gate: `tsc --noEmit`, ESLint, Vitest, and a production build must pass with no console errors.

## 15. Milestones (app stays runnable after each)

| # | Milestone | Done when |
|---|---|---|
| M0 | TS + Tailwind + Router + Query + tooling; env; Vite proxy; lint/test wiring | Builds and tests run; `/api/user` reachable in dev |
| M1 | Design tokens, themes, UI primitives, AppShell, responsive sidebar shell | Light/dark and mobile drawer work |
| M2 | Auth (login page, boot, protected routes, logout, 401 handling) | Real Google sign-in round trip |
| M3 | Conversations (list, groups, search, rename, delete, lazy create) | CRUD against real backend |
| M4 | Chat core (messages, Markdown, code blocks, send/retry/abort, empty state) | Chat agent end to end |
| M5 | Composer (agent selector, attachments, validation, 429 UX) | All agents callable |
| M6 | Files, images, sources, feedback | PDF/PPT/image/search results render |
| M7 | Artifacts panel + secure preview + ZIP | Coding agent end to end |
| M8 | Voice, motion, accessibility and responsive polish | Checklist passes |
| M9 | Tests, full QA, docs (env vars, run, build, deploy, limitations) | Final deliverables list complete |

I'll report at the end of each milestone and not start the next without your go-ahead if you'd prefer tighter control (say so; otherwise I'll continue through M0-M3 and pause for review).

## 16. Deployment notes

Build output is static (`vite build`). Serve it from S3 + CloudFront with a `/api/*` behavior routing to the gateway (ALB), so the browser sees one origin and the existing `strict` cookie works unchanged; set `COOKIE_SECURE=true`. Alternative on Vercel: rewrite `/api/*` to the gateway (I have not verified Vercel's rewrite timeouts against the 180 s agent calls; CloudFront/ALB is the safer fit here). The ALB idle timeout must be at least 180 s for agent requests.

## 17. Backend dependencies and known limitations

- No streaming: the UI shows staged progress, not live tokens (planned later).
- No regenerate, no message edit.
- PPT has no in-app preview (download only); PDF preview opens the browser viewer.
- Deleting a conversation leaves its S3 files and Qdrant data behind (backend cleanup pending).
- Image generation depends on a free third-party service.
- Voice depends on browser support.
- Live-credential paths (LLMs, S3, Qdrant, Firebase) were not verified on the backend; the first end-to-end run of the frontend will be their first real test.

## 18. What I need from you

1. **Approve this plan** (or list changes).
2. **Firebase:** confirm Google sign-in is enabled for the project and that `localhost:5173` is an authorised domain; I'll move the existing web config into `.env`.
3. **Gateway URL for local dev** (I'll assume `http://localhost:8000`) and that the backend runs locally with Redis and Mongo.
