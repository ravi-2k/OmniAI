---
title: OmniAI Backend
emoji: 🤖
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
---

# OmniAI backend on a Hugging Face Docker Space

This front matter is the Space config. The Space repo layout must be:

```
Dockerfile      <- deploy/huggingface/Dockerfile
start.sh        <- deploy/huggingface/start.sh
README.md       <- this file
backend/        <- the repo's backend/ folder
```

Build it from the OmniAI repo root:

```bash
rm -rf /tmp/hf-space && mkdir /tmp/hf-space
cp deploy/huggingface/{Dockerfile,start.sh,README.md} /tmp/hf-space/
rsync -a --exclude node_modules --exclude '*.env' --exclude firebaseServiceAcc.json backend /tmp/hf-space/
cd /tmp/hf-space && git init && git add . && git commit -m "deploy"
git remote add space https://huggingface.co/spaces/<user>/<space>
git push space HEAD:main --force
```

Never copy `firebaseServiceAcc.json` or `.env` files into the Space. Put secrets in
Space Settings -> Variables and secrets (see deploy/FREE_DEPLOY.md).
