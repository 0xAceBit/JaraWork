# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1.4.4 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Accept VITE_ build-time env vars as Docker build args
ARG VITE_CLIENT_KEY
ARG VITE_CLIENT_URL
ARG VITE_GAS_POLICY_ID
ARG VITE_MAINNET_ESCROW_CONTRACT_ADDRESS
ARG VITE_MAINNET_AGENT_WALLET_ADDRESS

# Copy source and build frontend
COPY . .
RUN VITE_CLIENT_KEY=$VITE_CLIENT_KEY \
    VITE_CLIENT_URL=$VITE_CLIENT_URL \
    VITE_GAS_POLICY_ID=$VITE_GAS_POLICY_ID \
    VITE_MAINNET_ESCROW_CONTRACT_ADDRESS=$VITE_MAINNET_ESCROW_CONTRACT_ADDRESS \
    VITE_MAINNET_AGENT_WALLET_ADDRESS=$VITE_MAINNET_AGENT_WALLET_ADDRESS \
    bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.4.4-slim AS runner

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
