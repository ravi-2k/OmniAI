# OmniAI Backend Audit

**Scope:** every source file under `backend/` (gateway, auth, chat and agent services, shared Redis, Dockerfiles, compose) plus the existing `frontend/` scaffold.
**Method:** static read only. No code was executed and no backend file was modified. Findings marked *(verify)* are strong inferences from reading the code and should be confirmed by running the service.
**Secrets:** `.env` files and the Firebase service-account JSON were inspected by key name only. No secret values are reproduced in this report.

---

## 1. Architecture

```
Browser ──cookie──▶ Gateway (Express 5, :PORT)
                      ├─ /api/auth   ─proxy─▶ Auth service   (Firebase verify, Mongo users, Redis sessions)
                      ├─ /api/user   (handled in gateway: returns session payload)
                      ├─ /api/chat   ─protect─▶ Chat service (Mongo: conversations, messages)
                      └─ /api/agent  ─protect─▶ Agent service (LangGraph + LLMs + S3 + Qdrant + Tavily)
Redis: sessions (gateway/auth), chat memory cache + per-agent rate limits (agent)
```

| Concern | Implementation |
|---|---|
| Runtime / framework | Node, Express 5, Mongoose 9, ioredis |
| Auth | Firebase ID token exchanged **once** at login for an httpOnly `session` cookie backed by Redis (7 days) |
| Service-to-service identity | Gateway sets `x-user-id` header; downstream services trust it |
| LLMs | Groq `openai/gpt-oss-120b` (chat, search, router, default), OpenRouter `deepseek/deepseek-chat` (coding, 2500 max tokens), Gemini `gemini-2.5-flash` (image analysis) |
| Orchestration | LangGraph `StateGraph`: `router` → agent node; `search` → `chat` |
| Storage | MongoDB (users, conversations, messages), S3 (generated files, presigned URLs), Qdrant (PDF chunks), Redis |
| Streaming | **None.** One request, one JSON response |
| Speech-to-text | **None** |

## 2. Public API (all via gateway; cookie `session` required unless noted)

| Method + path | Body / params | Success response | Notes |
|---|---|---|---|
| `POST /api/auth/login` (public) | JSON `{ token }` (Firebase ID token) | `200` user doc `{_id, firebaseUid, name, email, avatar, createdAt, updatedAt}`; sets `session` cookie | See C1: token is not actually verified |
| `POST /api/auth/logout` | cookie | `200 {message}` | See H3: does not delete the Redis session |
| `GET /api/user` | cookie | `200 {user:{userId,name,email,avatar}}` | Use for session restoration |
| `GET /api/chat/create-conversation` | none | conversation `{_id,userId,title:"New Chat",createdAt,updatedAt}` | State-changing GET |
| `GET /api/chat/get-conversation` | none | array of conversations, `updatedAt` desc | No pagination |
| `POST /api/chat/update-conversation` | `{id,title}` | the conversation **before** the update | Rename only; no delete endpoint |
| `POST /api/chat/save-message` | `{conversationId,role,content,images,artifacts}` | message doc | Exposed to clients; see C3 |
| `GET /api/chat/get-messages/:conversationId` | param | array of messages, `updatedAt` **desc (newest first)** | No pagination |
| `POST /api/agent/chat` | `multipart/form-data`: `prompt`, `conversationId`, `agent`, optional `file` | `{answer, images, artifacts}` | The only AI endpoint |

Unauthenticated or expired responses use **HTTP 400** (`{message:"Unauthorized"}` / `{message:"Session expired"}`), not 401.

### Message document
```
{ _id, conversationId, role: "user"|"assistent" (sic), content: string,
  images: string[], artifacts: [{ id:number, type:string, title:string, files:[{name,content}] }],
  createdAt, updatedAt }
```

### Agent values accepted in `agent` (router passes any non-`auto` value straight through)
`auto`, `chat`, `search`, `coding`, `pdf`, `ppt`, `vision`, `pdfRag`, `imageAnalyzer`

| Agent | What it really does | Input | Output shape |
|---|---|---|---|
| `chat` | LLM answer with last ≤20 messages as memory | prompt | Markdown in `answer` |
| `search` | Tavily search (5 results + images), then hands to `chat` | prompt | Markdown in `answer`, `images` = Tavily image URLs. **No structured sources/citations** |
| `coding` | LLM intent classifier. If exactly `CODE_GENERATION`: JSON project → `artifacts`. Otherwise Markdown explanation | prompt | `artifacts:[{id,type:"Project",title:<the prompt>,files:[{name,content}]}]` or `artifacts:[]` |
| `pdf` | **Generates** a PDF from a topic, uploads to S3 | prompt | Markdown in `answer` with a presigned download link. No structured file object |
| `ppt` | **Generates** a PPTX, uploads to S3 | prompt | Same pattern as PDF |
| `vision` | **Generates an image** (LLM-written prompt → pollinations.ai → S3) | prompt | Markdown `![..](url)` + download link in `answer` |
| `pdfRag` | **Answers questions about an uploaded PDF** (chunks → Qdrant → LLM) | prompt + PDF file | Markdown in `answer` |
| `imageAnalyzer` | **Understands an uploaded image** (Gemini vision) | prompt + image file | Markdown in `answer` |

Auto routing: with `agent` empty/`auto`, an attached PDF always routes to `pdfRag`, an attached image to `imageAnalyzer` (prompt ignored). Otherwise an LLM picks one of six words; anything unrecognised falls back to `chat`.

Rate limits (per user, per agent, per minute): chat 20, coding 5, pdf 5, ppt 5, image 5, search 5.

## 3. Authentication flow (as implemented)

1. Frontend signs in with Firebase, obtains an ID token.
2. `POST /api/auth/login {token}` → auth service looks up or creates a `User`, creates a random session id, stores `session-<id>` → `{userId,name,email,avatar}` in Redis for 7 days, sets cookie `session` (httpOnly, `secure:false`, `sameSite:"strict"`).
3. Every `/api/chat`, `/api/agent`, `/api/user` request: gateway reads the cookie, loads the session from Redis, forwards `x-user-id`.
4. Logout deletes the cookie (and intends to delete the Redis key).

**Consequence for the frontend:** there is no per-request `Authorization: Bearer` header. All requests must use `credentials: "include"`, and CORS is locked to the single `FRONTEND_URL`. This differs from the brief ("attach Firebase ID tokens to API requests") and is a decision for you (see questions).

---

## 4. Findings

Legend, **Fix where**: **B** = backend change needed (needs your approval), **F** = frontend can handle, **B+F** = both.

### 4.1 Critical: broken or insecure as written

| ID | Issue | Why it matters / impact | Recommended fix | Fix where |
|---|---|---|---|---|
| C1 | `auth.controller.js:10` calls `verifyIdToken(token)` **without `await`**. `isDecoded` is a pending Promise, so `isDecoded?.uid` is `undefined`. | The token is never validated. Any request body (even garbage) can "log in". Lookup by `firebaseUid: undefined` can match the wrong user, or create users with no uid/name/email. A rejected promise is also unhandled and can crash the process on current Node. | `const decoded = await getAuth(app).verifyIdToken(token)`; reject with 401 if missing/invalid; require `decoded.uid`. | B |
| C2 | `message.model.js:33` role enum is `["user","assistent"]` (typo), but the agent controller saves `role:"assistant"`. | The assistant-message save fails Mongoose validation → chat service 500 → agent controller throws *after* the LLM has already run, so `/api/agent/chat` very likely returns an empty-bodied 500 on every call and assistant replies are never persisted *(verify)*. | Fix enum to `"assistant"` (and migrate any existing `assistent` rows). | B |
| C3 | **No ownership checks** on chat data. `get-messages/:conversationId`, `save-message`, `update-conversation`, and `/api/agent/chat` (via `conversationId`) never verify the conversation belongs to `x-user-id`. | Any logged-in user who learns or guesses a conversation id can read other users' messages, rename their chats, inject fake messages (including forged `assistant` ones), or read their history through the LLM context. | Check `conversation.userId === x-user-id` in every chat/agent handler. Remove `save-message` from the public gateway surface (agent service calls it internally). | B |
| C4 | **Secrets are baked into Docker images.** `backend/.dockerignore` lists `.env`, which only matches the *root* of the build context. Services are built with context `backend/`, so `gateway/.env`, `services/*/.env` and `services/auth/firebaseServiceAcc.json` are copied in by `COPY <service> ./<service>`. The per-service `.dockerignore` files are not used with this context. | Anyone with pull access to the ECR images gets the LLM API keys, AWS keys, Mongo URL and Firebase service account. | Use `**/.env`, `**/*.json` credential patterns (`**/firebaseServiceAcc.json`) in `backend/.dockerignore`; inject config via ECS task env vars / Secrets Manager; **if images were already pushed, rotate those keys and delete the images.** | B |
| C5 | **Plaintext credentials in comments** inside the three service `.env` files (a MongoDB username and password), duplicated in each. | Anyone who sees the file or a copy of it has database access. Note: these lines were printed in this session's terminal output when I listed the env files. | Rotate the Mongo password now, delete the comments, keep secrets in a secret manager. | B |
| C6 | **Services will likely not start as written** *(verify)*: (a) gateway/auth/chat use extensionless relative imports (`"./controllers/user.controller"`) in `"type":"module"` packages, which plain Node ESM rejects; (b) `shared/redis/redis.js` does `import Redis from "redis"` but the dependency is `ioredis`; (c) agent is `"type":"commonjs"` yet uses `import` syntax; (d) `graph.js:13` uses `agentState`, which is never imported; (e) `coding.agent.js:3` imports `../utils/deductCredits.js`, which does not exist. | Containers crash on boot or on first import. | Add `.js` extensions, import from `ioredis`, set agent to `"type":"module"`, import `agentState` from `./state.js`, remove or create `deductCredits`. | B |
| C7 | `express-http-proxy` default body `limit` is **1 MB**; the gateway proxies `/api/agent` without overriding it *(verify)*. | Image/PDF uploads over ~1 MB fail with 413 even though multer allows 20 MB. | `proxy(url, { parseReqBody:false })` (or raise `limit`) for the agent route. | B |

### 4.2 High

| ID | Issue | Impact | Fix | Where |
|---|---|---|---|---|
| H1 | **Agent failures are returned as normal answers with HTTP 200.** Each agent catches its error and returns `aiResponse: error?.data?.message \|\| "failed to generate …"`. Rate-limit (429) errors from `chat/search/coding/pdf/ppt/pdfRag/vision` are swallowed the same way (only `imageAnalyzer` lets the 429 through). That text is then saved as an assistant message and added to chat memory. | The client cannot distinguish an error from an answer. Error text pollutes history and future LLM context. | Let agents throw; return `{success:false, code, message}` with proper status; do not persist error text. | B (F can only string-match, which is fragile) |
| H2 | **No `agent` or `files` field in the response.** Response is `{answer, images, artifacts}` only. | UI cannot show which agent Auto chose, and PDF/PPT/image downloads exist only as Markdown links inside `answer`. | Add `agent`, and a structured `files:[{name,type,url,size,expiresAt}]` to response and message schema. | B (F can regex-parse links as a fallback) |
| H3 | **Logout does not invalidate the session.** The auth service has no `cookie-parser`, so `req.cookies?.session` is `undefined` and Redis key `session-undefined` is deleted instead. | A stolen cookie stays valid for 7 days after logout. | Add `cookie-parser` to auth service (or move logout to the gateway). | B |
| H4 | **Cookie settings unsuitable for production**: `secure:false`; `sameSite:"strict"`. | Over HTTPS the cookie should be `Secure`. With the frontend and API on different registrable domains (for example a `*.vercel.app` frontend and an AWS API domain) `strict` means the browser never sends the cookie. | Serve frontend and API from the same site (`app.x.com` / `api.x.com`) and set `secure:true`, or use `SameSite=None; Secure` plus CSRF protection. | B + deployment decision |
| H5 | **Chat history order is wrong.** `get-messages` sorts `updatedAt` **descending**; the agent's memory loader uses the same call. | Frontend gets newest-first (must reverse). The LLM receives its memory in reverse chronological order, and the just-saved user prompt appears twice in context (it is already in the DB result, then appended again). | Sort ascending, and exclude the current prompt from memory. | B (F can reverse for display only) |
| H6 | **Uploaded files and PDF context have no lifecycle.** (a) Image/PDF is only read when the router picks `imageAnalyzer`/`pdfRag`; for any other agent the file is left in `./temp` forever. (b) Each PDF creates a new Qdrant collection `pdf-<timestamp>` that is never recorded or deleted. (c) The upload is not stored in S3 or on the message. | Disk and vector DB grow without bound; PDF Q&A is single-turn (follow-ups cannot reuse the PDF); uploaded images/PDFs vanish from history after reload; no per-user isolation in Qdrant. | Persist attachment metadata on the message, store uploads in S3, keep collection name per conversation, clean up. | B (F can show local previews only for the current session) |
| H7 | **No input validation anywhere**: prompt length, `conversationId` format, `role` values, `title` length, artifact size. | Cost abuse, Mongo cast errors surfacing as 500s, oversized documents. | Validate with zod/joi at gateway or each service. | B (F adds basic client-side limits) |
| H8 | **Trust in `x-user-id` header.** Chat and agent services have no authentication of their own. | Safe only if those services are unreachable except through the gateway. | Keep them in private subnets / security groups; consider a shared internal secret. | B / infra |

### 4.3 Medium

| ID | Issue | Impact | Fix | Where |
|---|---|---|---|---|
| M1 | `update-conversation` uses `findByIdAndUpdate` without `{new:true}` and returns the *old* document; title never auto-generated (stays "New Chat"). | UI shows stale title unless it patches state itself. | Return updated doc; auto-title from first message. | F can work around (set title locally) |
| M2 | Conversation `updatedAt` is not bumped when messages are added. | "Recents" order and "Today/Yesterday" grouping reflect renames, not activity. | Touch the conversation on `save-message`. | B (F can reorder locally) |
| M3 | No delete conversation, no pagination, no message count, no search, no regenerate, no feedback endpoints. | Features in the brief cannot be real without them. | Add endpoints. | B |
| M4 | **Misleading expiry text and inconsistent link lifetimes.** Text says "expires in 10 minutes"; actual: PDF 24 min, image 24 min, PPT 24 h (`getFromS3(filename, 24 * 60)` is *seconds*). Links are stored in message content and cannot be refreshed. | Downloads in older chats silently break. | Store the S3 key, add `GET /files/:key` that re-signs on demand; fix copy. | B |
| M5 | Generated project JSON: `JSON.parse(res.content)` on raw LLM output, `intent == "CODE_GENERATION"` exact match, OpenRouter `maxTokens: 2500`. | Large projects are truncated mid-JSON and fail; whitespace or casing in the intent breaks routing to generation. | Trim and normalise intent, increase token limit, use structured output/JSON mode, return a clear error. | B |
| M6 | Artifact `title` is the user's whole prompt; `type` is always `"Project"`; no language or entry-file metadata; no preview or ZIP endpoint. | Tab titles are unwieldy; preview must be assembled client-side. | Add short `title`, `entry` file, language per file. | B+F (F can assemble HTML/CSS/JS into a sandboxed `srcdoc`) |
| M7 | Environment loading order: `redis.js`, `llmModels.js`, `s3.js` read `process.env` at import time, before `dotenv.config()` in each `index.js` runs. | Locally Redis falls back to localhost and API keys may be undefined; works in ECS only because env vars are injected. | Load dotenv first (`import "dotenv/config"`). | B |
| M8 | Gateway proxy and LLM calls have no timeouts; a request can run for tens of seconds with no progress signal. | Load balancers (ALB default 60 s) may cut requests; no cancel or retry semantics. | Set proxy timeouts; consider streaming or job-style endpoints. | B (F needs long timeout + cancel) |
| M9 | `search` followed by `chat` consumes **both** the search and chat rate limits per request. Rate-limit incr/expire is non-atomic. | Users hit limits sooner than the documented numbers. | Count once per request; use a Lua/`SET NX EX` pattern. | B |

### 4.4 Low

| ID | Issue |
|---|---|
| L1 | `multer.js:16` uses `${Date.now}` (function reference, not called) in the temp filename. |
| L2 | `generatePdf.js`: `fillColor` is set *after* the text it should style; `doc.on("error", () => reject)` never rejects; undefined `subtitle` is passed to `.text()`. |
| L3 | Error messages use `${error \|\| error.message}` (always the first operand), which can leak internals such as Mongo/Axios text. |
| L4 | `save-message` and `create-conversation` are reachable with GET/POST inconsistently (`create-conversation` and `get-conversation` are GETs that mutate or are not RESTful). |
| L5 | `morgan` is installed but unused; logging is `console.log` only; no request ids; no `/health` endpoint distinct from `/`. |
| L6 | `FROM node` with no tag (floating latest) in all Dockerfiles; images run as root; `npm install` instead of `npm ci`. |
| L7 | Image generation depends on the free `image.pollinations.ai` endpoint with no auth, SLA or content controls. |
| L8 | `login` returns the full user document including `firebaseUid` to the browser. |
| L9 | No tests anywhere in the backend (`npm test` is a stub). |

## 5. Engineering-principles review

- **Separation of concerns:** routes/controllers/models are cleanly split in chat and auth; the agent controller mixes persistence, orchestration and memory updates, and the agents mix prompting, I/O, error shaping and rate limiting.
- **DRY:** `db.js` is copied three times; the `try/catch` + `error || error.message` pattern is repeated everywhere; agents repeat the same limit/model/error scaffolding.
- **Validation / config / errors:** no validation layer, no central config module, no consistent error contract (see H1, H7, L3).
- **Security:** see C1, C3, C4, C5, H3, H4, H8.
- **SOLID:** `getModel(name)` with string cases and the `graph.js` switch are open for refactor into a registry; otherwise the codebase is small enough that this is not the priority.

## 6. Capability matrix against the product brief

| Requirement in brief | Backend reality | Status |
|---|---|---|
| Google sign-in via Firebase | Login endpoint exists, but token not verified (C1); cookie session, not bearer | Partial |
| Load previous conversations | `get-conversation` | Yes (no pagination) |
| Load messages | `get-messages/:id` | Yes (newest first) |
| Rename conversation | `update-conversation` | Yes |
| Delete conversation | none | **Missing** |
| Search conversations | none | Frontend-only on titles |
| Message count / timestamps | timestamps yes, count no | Partial |
| Auto / Chat / Search / Coding / PDF / PPT agents | exist | Yes |
| "Vision" = image understanding | `vision` generates images; understanding is `imageAnalyzer` | **Naming mismatch** |
| "PDF" = PDF handling | `pdf` generates; reading is `pdfRag` | **Naming mismatch** |
| Indicate which agent Auto chose | not returned | **Missing** |
| Search citations / source cards | not returned in structured form | **Missing** |
| Streaming | none | **Missing** |
| Cancel generation | none | Client abort only; server keeps running |
| Regenerate / feedback | none | **Missing** |
| File upload (image, PDF, ≤20 MB) | multer, but proxy limit (C7) and no persistence (H6) | Partial |
| Structured downloadable files | links inside Markdown | **Missing** (H2, M4) |
| Artifacts (multi-file code) | yes, persisted with messages | Yes |
| Artifact preview / ZIP | none server-side | Frontend can build `srcdoc` and ZIP |
| Voice transcription | none | **Missing** (browser Web Speech API is an alternative) |
| Rate limiting | per agent per minute | Yes, but errors hidden (H1) |

## 7. What the frontend can and cannot absorb

**Can handle (with workarounds):** reversing message order, local conversation re-sorting, setting a title after the first message, assembling HTML/CSS/JS previews, parsing download links from Markdown, client-side file validation, long timeouts and aborts.

**Cannot be fixed on the frontend:** C1–C7, H1 (error vs. answer), H3, H5 (LLM memory order), H6 (attachment persistence), delete conversation, streaming, structured sources, durable file links.

## 8. Existing frontend scaffold

`frontend/` is Vite 8 + React 19 in **plain JavaScript** with Firebase 13 as the only extra dependency. There is no TypeScript, router, Tailwind or markdown tooling. `App.jsx` is a placeholder. `src/utils/firebase.js` has the Firebase web config hardcoded (public by design, but should move to `VITE_` env vars) and calls `getAnalytics` at import time.

---

## 9. Fix status (applied after approval)

Backups of the pre-fix source (without secrets) were kept outside the project. All changes were verified against throwaway Redis and Mongo containers, not your real data (see "How it was verified").

| ID | Status | What changed |
|---|---|---|
| C1 | Fixed | `verifyIdToken` is awaited; invalid or missing token returns 401/400; user upsert is race-safe; login returns `{_id,name,email,avatar}` only. Also fixed `firebase-admin` v14 import (`admin.credential` no longer exists). |
| C2 | Fixed | Role enum is `user`/`assistant`. |
| C3 | Fixed | Every chat/agent operation checks the conversation belongs to the caller (404 otherwise). `save-message(s)` are blocked at the gateway. |
| C4 | Fixed | `.dockerignore` uses `**/` patterns. Verified no `.env` or service-account file inside the images. Firebase credential now comes from env (`FIREBASE_SERVICE_ACCOUNT_BASE64`). **If images were already pushed, rotate keys and delete them.** |
| C5 | Partly | Plaintext credential comments removed from the `.env` files. **You must still rotate the Mongo password.** |
| C6 | Fixed | `.js` import extensions, `ioredis` import, agent is ESM, `agentState` imported, `deductCredits` import removed. All four services boot. |
| C7 | Fixed | Agent route is streamed through the gateway (no 1 MB cap). Verified with a 2.5 MB upload. |
| H1 | Fixed | Agents throw; consistent `{success:false, code, message}` with real status codes (429 for rate limits). Error text is no longer saved as an answer. |
| H2 | Fixed | Response adds `agent`, `files[]`, `sources[]`, `attachments[]`, `userMessage`, `assistantMessage`. Existing `answer`, `images`, `artifacts` unchanged. |
| H3 | Fixed | Auth service uses `cookie-parser`; logout deletes the Redis session. |
| H4 | Configurable | `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`. The right values depend on your domains (open question). |
| H5 | Fixed | Messages are oldest to newest. The prompt is saved only after success, so it is no longer duplicated in LLM context. Memory reloads from the database. |
| H6 | Fixed | Temp files always deleted; uploads stored in S3 and recorded on the message; PDF collection is per conversation and replaced on re-upload. Remaining: deleting a conversation does not yet delete its S3 objects or Qdrant collection. |
| H7 | Fixed | Validation for ids, agent names, prompt length, titles, roles, array sizes, file types and sizes. |
| H8 | Fixed (opt-in) | Optional `INTERNAL_API_KEY` shared secret between gateway and services. **Set it in deployment.** Keep services off the public internet regardless. |
| M1 | Fixed | Rename returns the updated document; first message auto-titles the chat. |
| M2 | Fixed | Conversation `updatedAt` and `messageCount` update on every message. |
| M3 | Mostly | Added delete, pagination (`limit`, `before`), title search (`q`), message count, feedback. **Regenerate not implemented** (needs a product decision). |
| M4 | Fixed | Files store an S3 key; `GET /api/agent/file-url?key=` returns fresh URLs; real lifetime (1 h, configurable); no URLs baked into message text. |
| M5 | Fixed | Tolerant JSON parsing, normalised intent, 8000 max tokens, file-name sanitising, clear 502 on bad output. Not exercised against live LLMs. |
| M6 | Fixed | Artifacts have a short `title`, an `entry` file and per-file `language`. |
| M7 | Fixed | `dotenv/config` is the first import everywhere. |
| M8 | Partly | Gateway timeouts (180 s for agent) with JSON 504/502. No streaming. |
| M9 | Fixed | Search no longer also consumes the chat limit; rate-limit TTL cannot be lost. |
| L1-L3, L5, L8 | Fixed | Temp names, PDF styling and rejection, safe error messages, `morgan` + `/health`, trimmed login response. |
| L4 | Partly | Added `POST /create-conversation`; the GET is kept for compatibility. |
| L6 | Fixed | `node:24-slim`, `npm ci`, non-root user, `node index.js` as the entrypoint. |
| L7 | Open | Image generation still uses pollinations.ai. |
| L9 | Open | No test suite committed to the repo. |

### Contract changes the frontend must know

1. Unauthenticated: **401** `{code:"UNAUTHORIZED"|"SESSION_EXPIRED"}` (was 400).
2. All errors: `{success:false, code, message}` with a non-2xx status. A 200 from `/api/agent/chat` is always a real answer. Rate limit: 429 with `retryAfter`, `remainingTime`.
3. `get-messages` returns oldest to newest, default 100 (`?limit=` up to 200, `?before=<messageId>`). `get-conversation` returns 50 by default (`?limit`, `?before=<ISO date>`, `?q=`).
4. Generated PDF/PPT/images arrive in `files[]` (`name,type,mimeType,size,key,url,downloadUrl,expiresAt`), not as links in `answer`. After a reload, call `GET /api/agent/file-url?key=&name=`.
5. New endpoints: `GET /api/chat/conversation/:id`, `DELETE /api/chat/delete-conversation/:id`, `POST /api/chat/feedback {messageId,value:"up"|"down"|null}`, `GET /api/agent/file-url`.
6. With an attachment: `pdf` + PDF and `auto` + PDF answer questions about it; `vision` + image and `auto` + image analyse it. `pdfRag` without a file asks about the conversation's last PDF. `vision`/`pdf` without a file still generate.
7. Allowed uploads: PDF, JPEG, PNG, WebP, GIF, HEIC/HEIF, up to 20 MB.
8. New user messages carry `attachments[]` (name, mimeType, size, key).

### How it was verified

- All modules load under plain Node for all four services; all four containers' source passes `node --check`.
- 61 HTTP checks through the gateway (auth, ownership between two users, pagination, search, rename, feedback, delete, upload limits, file ownership, logout) passed on three consecutive runs.
- 24 unit checks: rate limit including 429 propagation through LangGraph, file-aware routing, JSON parsing, file-key ownership, cookie options.
- Real PDF and PPTX generation.
- **Not verified:** real LLM, Tavily, S3 upload, Qdrant/embedding and Firebase sign-in calls (they need live credentials). Treat those paths as needing one manual smoke test.
