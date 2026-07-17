# Stage 1: Builder image
FROM node:26-alpine AS builder

# Install pnpm matching the project version
RUN npm install -g pnpm@11

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN pnpm run build

# Stage 2: Production runner
FROM node:26-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy the self-contained Nitro build output
WORKDIR /app
COPY --from=builder /app/.output ./.output

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", ".output/server/index.mjs"]
