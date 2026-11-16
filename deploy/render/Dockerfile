# Single container running gateway + auth + chat + agent on Render.
# Render settings: Language = Docker, Dockerfile Path = deploy/render/Dockerfile,
# Docker Build Context Directory = . (repo root).
FROM node:24-slim

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/gateway/package*.json ./gateway/
COPY backend/services/auth/package*.json ./services/auth/
COPY backend/services/chat/package*.json ./services/chat/
COPY backend/services/agent/package*.json ./services/agent/
RUN for d in gateway services/auth services/chat services/agent; do (cd $d && npm ci --omit=dev); done

COPY --chown=node:node backend/gateway ./gateway
COPY --chown=node:node backend/services ./services
COPY --chown=node:node backend/shared ./shared
COPY --chown=node:node deploy/huggingface/start.sh ./start.sh

RUN chmod +x start.sh && mkdir -p /tmp/omniai-uploads && chown node:node /tmp/omniai-uploads

USER node
# Render routes public traffic to PORT (set PORT=8000 in the service env).
EXPOSE 8000
CMD ["./start.sh"]
