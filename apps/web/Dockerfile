FROM node:22.22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install

FROM node:22.22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/web ./apps/web
EXPOSE 3001
CMD ["npm", "run", "dev:web"]
