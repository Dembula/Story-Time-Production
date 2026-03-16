# Demo accounts

Use these credentials to explore the platform. **Password for all accounts:** `storytime2025` (or set `DEMO_PASSWORD` in `.env`).

## How to sign in

- **Viewers (subscribers):** [Sign In](/auth/signin) or [Sign Up](/auth/signup), then choose a plan at onboarding.
- **Creators and companies:** [Creator Sign In](/auth/creator/signin) or [Creator Sign Up](/auth/creator/signup).
- **Admin:** [Admin Login](/auth/admin). Same password as above. Admin can approve other users’ admin requests from **Admin → Admin requests**.

## Account list

| Role | Email | Notes |
|------|--------|------|
| **Admin** | **admin@storytime.com** | Full admin dashboard. Manage users, content, revenue, admin requests, etc. |
| **Subscriber (viewer)** | **viewer@storytime.com** | Browse and watch. Use Sign In (not Creator Sign In). |
| **Content creator** | **creator@storytime.com** | Creator dashboard, content, stats, Crew & Cast, Equipment, Locations, Catering. |
| **Content creator** | creator2@storytime.com | Second creator (Studio Films Co). |
| **Music creator** | **music@storytime.com** | Music creator dashboard, sync requests. |
| **South African Indie** | safilms@storytime.com | Content creator. |
| **Student film creators** | afda.student1@storytime.com, afda.student2@storytime.com, afda.student3@storytime.com | Content creators (student films). |
| **Property / Location owner** | **property@storytime.com** | Location owner dashboard (listings, bookings, messages). |
| **Location owner (Cape)** | capestudios@storytime.com | Location owner. |
| **Location owner (Joburg)** | joburglocations@storytime.com | Location owner. |
| **Crew team** | **crew@storytime.com** | Crew team dashboard: profile, team members, requests from creators. |
| **Casting agency** | **casting@storytime.com** | Casting agency dashboard: profile, talent roster, inquiries. |
| **Equipment company** | **cinegear@storytime.com** | Equipment company dashboard (listings, requests). |

After signing in, you are redirected by role (e.g. location owners → `/location-owner/dashboard`, creators → `/creator/dashboard`, admin → `/admin`, viewer → `/browse`).

## Seeding the database

To (re)create all demo users and content:

```bash
npx prisma db seed
```

Or with tsx directly:

```bash
npm run db:seed
```

This seeds admin (with hashed password), all demo users, content, equipment, locations, crew, casting, subscriptions, and related data.
