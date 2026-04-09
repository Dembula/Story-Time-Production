## Vercel setup for Storytime uploads

This project already uploads through:

- `src/app/api/upload/content-media/route.ts`

That route reads `STORAGE_*` env vars and uploads to S3 with AWS SDK.

### 1) Add environment variables

In Vercel:

- Project -> Settings -> Environment Variables
- Add values from `deploy/connection-pack/.env.vercel.production.template`
- Add to `Production` and `Preview`

Required storage keys:

- `STORAGE_REGION`
- `STORAGE_BUCKET_NAME`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_ENDPOINT` (blank for normal S3)
- `UPLOAD_MAX_FILE_SIZE_MB` (optional, defaults to `200`)

### 2) Redeploy

After adding env vars, redeploy your project so runtime picks up new values.

### 3) Domain alignment

Make sure these line up:

- `NEXTAUTH_URL` = your app domain on Vercel/custom domain
- `STORAGE_PUBLIC_BASE_URL` = Cloudflare media domain

### 4) Verify in app

- Go to creator upload flow and upload a file.
- Check network response from `/api/upload/content-media`.
- Confirm response returns `ok: true` and a `publicUrl` under your media domain.
- Confirm unauthenticated calls to `/api/upload/content-media` return `401`.

### 5) Troubleshooting

- `Storage is not configured`:
  - missing `STORAGE_BUCKET_NAME` or `STORAGE_REGION`
- `Upload failed` with AWS error:
  - wrong access key/secret
  - missing IAM permissions
  - wrong region or bucket name
- URL works in API response but not in browser:
  - Cloudflare DNS/origin mismatch
  - bucket/object public access mismatch
