# SmartMotel Hub — Phase 1

Phase 1 only: project foundation, Next.js web app, NestJS API, PostgreSQL + PostGIS, Prisma schema/migration, Docker, and a database-aware health endpoint.

## Stack

- Next.js 16.3.3 + TypeScript
- NestJS 11 + TypeScript
- Prisma ORM 7.10
- PostgreSQL 17 + PostGIS 3.5
- Docker Compose

## Prerequisites

- Node.js >= 22.12
- npm >= 10
- Docker Desktop

## 1. Environment

Copy `.env.example` to `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Also copy the root env file into the API workspace so Prisma CLI can load `DATABASE_URL` directly:

Windows PowerShell:

```powershell
Copy-Item .env apps/api/.env
```

macOS/Linux:

```bash
cp .env apps/api/.env
```

## 2. Install packages

```bash
npm install
```

## 3. Start only PostgreSQL/PostGIS

```bash
docker compose up -d db
```

## 4. Generate Prisma Client and apply the initial migration

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

The migration enables both `pgcrypto` and `postgis`, creates the Phase 1 tables, and adds a trigger that keeps `properties.location` synchronized with latitude/longitude.

## 5. Run API and Web locally

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

Open:

- Web: http://localhost:3000
- API health: http://localhost:4000/api/v1/health

## Full Docker mode

After `.env` exists:

```bash
docker compose up -d --build
```

Then apply database migrations inside the API container if this is a fresh database:

```bash
docker compose exec api npm run prisma:deploy
docker compose exec api npm run prisma:seed
```

## Database models in Phase 1

- users
- properties
- rooms
- amenities
- room_amenities
- listings
- listing_images
- favorites
- appointments
- reviews
- contracts
- invoices
- complaints

No authentication flow, business UI, search, booking workflow, payment gateway, or admin screens are implemented in this phase.
