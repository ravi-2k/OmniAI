# Single container running gateway + auth + chat + agent.
# Hugging Face Docker Space: put this file at the ROOT of the Space repo,
# next to the `backend/` folder (see deploy/huggingface/README.md).
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
COPY --chown=node:node start.sh ./start.sh

RUN chmod +x start.sh && mkdir -p /tmp/omniai-uploads && chown node:node /tmp/omniai-uploads

USER node
EXPOSE 8000
CMD ["./start.sh"]
