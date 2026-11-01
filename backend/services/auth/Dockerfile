FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY ./services/auth/package*.json ./services/auth/
RUN cd services/auth && npm ci --omit=dev

COPY --chown=node:node services/auth ./services/auth
COPY --chown=node:node shared ./shared

WORKDIR /app/services/auth

USER node

EXPOSE 8001

CMD [ "node", "index.js" ]
