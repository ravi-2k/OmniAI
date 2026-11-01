# ---- build: compile the static site -------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Public Firebase web config is baked into the bundle at build time (it is not a secret).
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
RUN npm run build

# ---- serve: unprivileged nginx on :8080 -----------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
