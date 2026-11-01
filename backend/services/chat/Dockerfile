FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY ./services/chat/package*.json ./services/chat/
RUN cd services/chat && npm ci --omit=dev

COPY --chown=node:node services/chat ./services/chat
COPY --chown=node:node shared ./shared

WORKDIR /app/services/chat

USER node

EXPOSE 8002

CMD [ "node", "index.js" ]
