# Free end-to-end deployment

Frontend: Vercel. Backend (4 services): one Hugging Face Docker Space.
Redis: Upstash. Files: Supabase Storage (S3 API). MongoDB Atlas, Qdrant, Firebase unchanged.

## 1. Accounts to create (you do these)
- Hugging Face (Space, SDK = Docker, hardware = CPU basic, free)
- Upstash (Redis database, copy the `rediss://` URL)
- Supabase (project -> Storage -> new private bucket; Settings -> Storage -> S3 connection:
  copy endpoint, region, access key id and secret)
- Vercel (import the GitHub repo, Root Directory = `frontend`)

## 2. Space secrets (Settings -> Variables and secrets)
Gateway: `FRONTEND_URL` (your Vercel URL), `REDIS_URL` (Upstash), `INTERNAL_API_KEY`
Auth: `MONGO_URL`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `COOKIE_SECURE=true`
Chat: `MONGO_URL`
Agent: `MONGO_URL`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`,
`QDRANT_URL`, `QDRANT_API_KEY`,
`S3_ENDPOINT` (Supabase S3 endpoint), `AWS_REGION` (Supabase region),
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_KEY`, `AWS_BUCKET_NAME`
All services share one environment in the Space, so each variable is set once.
`AUTH_SERVICE`, `CHAT_SERVICE` and `AGENT_SERVICE` are set by `start.sh`.

## 3. Push the backend
Follow `deploy/huggingface/README.md`. Then open
`https://<user>-<space>.hf.space/` and check the gateway health route.

## 4. Frontend
Edit `frontend/vercel.json`: replace `REPLACE-USER-REPLACE-SPACE` with your Space host.
Set the four `VITE_FIREBASE_*` variables in Vercel, leave `VITE_API_BASE` empty, deploy.

## 5. Firebase
Authentication -> Settings -> Authorized domains: add the Vercel domain.

## Notes
- Free Spaces sleep after about 48 h idle; the first request then takes about a minute.
- `.github/workflows/deploy.yml` still targets AWS and will fail on push. Disable or delete it.
- Existing files in the old S3 bucket are not migrated; new files go to Supabase.
