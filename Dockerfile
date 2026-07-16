# Stage 1: Base image
FROM node:20-alpine AS base

# Install pnpm matching the project version
RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN pnpm build

# Stage 4: Install only production dependencies
FROM base AS prod-dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Stage 5: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary runtime artifacts
COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=prod-dependencies /app/node_modules ./node_modules

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server/server.js"]
