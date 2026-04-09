## Storytime connection pack

This folder gives you copy/paste files to connect:

- AWS S3 bucket + IAM uploader user
- Cloudflare media domain
- Vercel runtime env vars

Your app code that uses these values is:

- `src/app/api/upload/content-media/route.ts`

---

## Files in this pack

### `.env.vercel.production.template`

What it does:

- Defines all env vars your upload route needs in Vercel.

Where to use:

- Vercel -> Project -> Settings -> Environment Variables.

### `iam-policy-storytime-uploader.json`

What it does:

- Grants least-privilege upload access for `uploads/*` in your S3 bucket.

Where to use:

- AWS IAM -> Users -> `storytime-uploader` -> Add inline policy.

### `s3-cors.json`

What it does:

- Allows browsers on your app domains to GET/HEAD media objects from S3 origin.

Where to use:

- AWS S3 -> Bucket -> Permissions -> CORS configuration.

### `cloudflare-setup.md`

What it does:

- Shows exact Cloudflare DNS/SSL/cache setup for media hostname.

### `vercel-setup.md`

What it does:

- Shows Vercel env + redeploy + verification steps.

---

## API keys / tokens you need

### Required now

1) AWS IAM access key pair for uploader user

- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- Get from: AWS Console -> IAM -> Users -> `storytime-uploader` -> Security credentials -> Create access key

2) S3 metadata

- `STORAGE_BUCKET_NAME`
- `STORAGE_REGION`
- Get from: AWS Console -> S3 -> bucket details

3) Cloudflare media URL

- `STORAGE_PUBLIC_BASE_URL`
- Get from: your Cloudflare DNS hostname, e.g. `https://media.storytime.yourdomain.com`

### Optional (only for automation scripts, not required for current upload route)

1) Cloudflare API

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- Get from: Cloudflare Profile -> API Tokens, and Zone Overview

2) Vercel API

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_ORG_ID`
- Get from: Vercel Account Settings -> Tokens, and Project Settings

---

## Important replacements before use

- Replace all domain placeholders with your real app/media domains.
- Replace `YOUR_BUCKET_NAME` and `YOUR_REGION` placeholders in IAM/S3 policy files.
- Keep key names exactly as shown; only swap values.
- Neon key names remain unchanged (`DATABASE_URL`, `DIRECT_URL`).
