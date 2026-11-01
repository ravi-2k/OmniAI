FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY ./gateway/package*.json ./gateway/
RUN cd gateway && npm ci --omit=dev

COPY --chown=node:node gateway ./gateway
COPY --chown=node:node shared ./shared

WORKDIR /app/gateway

USER node

EXPOSE 8000

CMD [ "node", "index.js" ]
