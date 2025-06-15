# Multi-stage Docker build for AI Games Slack App
FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S aiapp -u 1001

WORKDIR /app

# Copy built application
COPY --from=build --chown=aiapp:nodejs /app/dist ./dist
COPY --from=deps --chown=aiapp:nodejs /app/node_modules ./node_modules
COPY --chown=aiapp:nodejs package*.json ./

# Add health check script
COPY --chown=aiapp:nodejs scripts/health-check.js ./scripts/
RUN chmod +x ./scripts/health-check.js

# Create logs directory
RUN mkdir -p /app/logs && chown aiapp:nodejs /app/logs

# Switch to non-root user
USER aiapp

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node ./scripts/health-check.js

# Start the application
CMD ["node", "dist/app.js"]