# STORY TIME - Home Of Independent Creators

A Netflix-inspired streaming platform for independent creators. Browse movies, series, shows, and podcasts. Creators earn revenue based on watch time share. Music creators can upload tracks for sync deals.

## Features

- **Subscriber Dashboard**: Browse content by category, play videos, BTS section, comments, ratings
- **Content Creator Dashboard**: Stats, watch time analytics, revenue based on platform attention share
- **Music Creator Dashboard**: Upload tracks, track sync deals and earnings
- **Admin Dashboard**: Overview of users, content, revenue, moderation

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- NextAuth.js (Email, Google, GitHub, Magic link)
- TanStack Query
- Recharts

## Prerequisites

- Node.js 18+

## Setup (SQLite - no database server needed)

1. **Install and setup**

   ```bash
   npm install
   npx prisma db push
   npm run db:seed
   ```

2. **Environment** - `.env` is pre-configured for SQLite. For production, set:
   - `DATABASE_URL` - Use PostgreSQL connection string if needed
   - `NEXTAUTH_SECRET` - Run `openssl rand -base64 32` to generate
   - `NEXTAUTH_URL` - Your app URL (e.g. http://localhost:3000)

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Demo users (after seed)

For **Creator Sign In** ([/auth/creator/signin](http://localhost:3000/auth/creator/signin)), use password **`storytime2025`** with any of the seed emails. See [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) for the full list.

**Property / location owner dashboard:** sign in with **`property@storytime.com`** and password **`storytime2025`** to see the location owner dashboard (listings, bookings, messages).

## Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` / `npm run verify` - Type-check and lint (no build)
- `npm run test:smoke` - Start dev server and verify it responds (smoke test)
- `npm run db:seed` - Seed demo data
- `npm run db:studio` - Open Prisma Studio

## Testing

- **Quick checks (no build):** `npm run test` runs TypeScript type-check and ESLint. Use this to verify code without running a full build.
- **Smoke test:** `npm run test:smoke` starts the dev server and ensures it responds at http://localhost:3000. Requires a free port and exits after the check.
- **Full build:** On some Windows environments, `npm run build` can fail during static generation (e.g. “spawn UNKNOWN”). If that happens, use `npm run dev` for local testing and run production builds in CI (e.g. GitHub Actions) or WSL.

## Project Structure

```
src/
  app/
    (auth)/auth/signin     - Sign in page
    browse/                - Subscriber browse + content detail
    creator/               - Content creator dashboard
    music-creator/         - Music creator dashboard  
    admin/                 - Admin dashboard
  components/
    layout/                - Navbar, Hero, ContentRow
    player/                - VideoPlayer, BTS, Comments, Ratings
    ui/                    - Button, Card, Input, etc.
  lib/
    auth.ts                - NextAuth config
    prisma.ts
    revenue.ts             - Revenue calculation
    utils.ts
```
