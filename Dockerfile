# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-slim AS runner

WORKDIR /app

# Copy only what we need to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# Expose the port Render assigns via $PORT (default 10000)
ENV PORT=10000
EXPOSE 10000

# Single process: agent server also serves dist/
CMD ["bun", "run", "server/agent.ts"]
