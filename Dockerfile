# Preflight production runtime: the SAME Node server that serves the built
# console + synthetic portal and runs real Playwright Chromium for
# POST /api/execute. The Playwright base image already contains Chromium and
# its Linux dependencies, so no second browser install is needed. Railway
# detects this Dockerfile automatically; it injects PORT (see HOST/PORT env).
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

# Reproducible dependency install first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

# Build frontend + production server bundle.
COPY . .
RUN npm run build && npm run build:server

ENV HOST=0.0.0.0
EXPOSE 4173

# Existing production server: static dist + portal + /api/health + /api/execute.
CMD ["npm", "start"]
