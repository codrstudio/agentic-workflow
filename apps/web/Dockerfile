# Multi-stage build for web
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm -w @arc/web run build

# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install http-server for SPA serving
RUN npm install -g http-server

# Copy built artifacts from builder stage
COPY --from=builder /app/apps/web/dist /app/public

# Set environment
ENV NODE_ENV=production

# Expose web port
EXPOSE 2102

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:2102/ || exit 1

# Serve SPA with http-server (single-page app fallback)
CMD ["http-server", "/app/public", "-p", "2102", "-c-1", "-s"]
