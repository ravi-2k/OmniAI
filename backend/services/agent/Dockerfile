FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY ./services/agent/package*.json ./services/agent/
RUN cd services/agent && npm ci --omit=dev

COPY --chown=node:node services/agent ./services/agent
COPY --chown=node:node shared ./shared

WORKDIR /app/services/agent

USER node

EXPOSE 8003

CMD [ "node", "index.js" ]
