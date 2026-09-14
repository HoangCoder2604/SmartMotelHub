# SmartMotel Hub — Vercel + Supabase deployment prep

This patch prepares the existing monorepo for two independent Vercel projects:

- `apps/web` → Next.js frontend
- `apps/api` → NestJS backend
- Supabase PostgreSQL/PostGIS → cloud database
- Supabase Storage → persistent listing images

## What changed

1. NestJS honors Vercel's `PORT` environment variable.
2. Prisma CLI uses `DIRECT_URL` when available; runtime still uses pooled `DATABASE_URL`.
3. Prisma pg adapter pool defaults to a small serverless-safe pool (`DATABASE_POOL_MAX=2`).
4. Listing image upload automatically uses Supabase Storage when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are configured; local filesystem remains a development fallback.
5. Next.js production `start` no longer hardcodes port 3001.
6. Environment examples include Vercel/Supabase/VNPAY production-style variables.

## Required cloud setup

### Supabase

- Create a Supabase project.
- Enable PostGIS.
- Create a **public** Storage bucket named `listing-images`.
- Copy the Transaction pooler URL to `DATABASE_URL`.
- Copy Direct or Session pooler URL to `DIRECT_URL`.
- Copy Project URL to `SUPABASE_URL`.
- Copy the **service_role** key to `SUPABASE_SERVICE_ROLE_KEY` on the backend only.

### Database migration

Before deploying the API, run locally with the Supabase URLs in `apps/api/.env`:

```powershell
npm run db:generate
npm run db:deploy
npm run db:seed
```

Run `db:seed` only if you want the seed data in the cloud database.

### Vercel frontend project

Import the GitHub repository and set Root Directory to `apps/web`.

Environment variables:

- `NEXT_PUBLIC_API_URL=https://YOUR-API-PROJECT.vercel.app/api/v1`
- Firebase `NEXT_PUBLIC_*` values
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### Vercel API project

Import the same GitHub repository again and set Root Directory to `apps/api`.

Backend environment variables:

- `DATABASE_URL`
- `DIRECT_URL` (optional at runtime, useful for CLI/deployment workflows)
- `DATABASE_POOL_MAX=2`
- `WEB_ORIGIN=https://YOUR-WEB-PROJECT.vercel.app`
- Firebase Admin values
- Supabase Storage values
- VNPAY values

### VNPAY

Once both Vercel URLs are stable:

- `VNPAY_RETURN_URL=https://YOUR-API-PROJECT.vercel.app/api/v1/payments/vnpay/return`
- `VNPAY_WEB_RESULT_URL=https://YOUR-WEB-PROJECT.vercel.app/payments/result`
- `VNPAY_IPN_URL=https://YOUR-API-PROJECT.vercel.app/api/v1/payments/vnpay/ipn`

## Important

Old locally uploaded listing images are not automatically copied to Supabase Storage. Re-upload them after deployment, or migrate them separately.
