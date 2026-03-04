# Stage 1: Build the Vite application + server
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Accept build-time base path (defaults to /)
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Build client (Vite) and server (TypeScript)
RUN npm run build

# Stage 2: Production Node.js runtime
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only runtime server dependencies (no frontend bundle deps)
COPY package.runtime.json ./package.json
RUN npm install --omit=dev --omit=optional --no-audit --no-fund \
  && npm cache clean --force

# Copy built client assets
COPY --from=build /app/dist ./dist

# Copy built server
COPY --from=build /app/dist-server ./dist-server

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 3000

ENV PORT=3000
ENV DATA_DIR=/data

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist-server/index.js"]
