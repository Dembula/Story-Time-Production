## Cloudflare setup for Storytime media

This connects Cloudflare to your S3 media bucket so your app serves media from a CDN URL.

### 1) Create media hostname

In Cloudflare DNS, create:

- Type: `CNAME`
- Name: `media`
- Target: your S3 origin hostname

For AWS S3 virtual-host style, the target is usually:

- `YOUR_BUCKET_NAME.s3.YOUR_REGION.amazonaws.com`

Resulting URL should be:

- `https://media.yourdomain.com`

Use this exact URL for:

- `STORAGE_PUBLIC_BASE_URL`

### 2) SSL/TLS

In Cloudflare SSL/TLS:

- Set mode to `Full` (or `Full (strict)` if certificate chain is valid end-to-end).
- Enable `Always Use HTTPS`.

### 3) Caching

In Cloudflare Caching:

- Default caching works, but for stronger performance add a cache rule:
  - If hostname is `media.yourdomain.com`
  - Cache eligible responses
  - Respect origin cache headers (or set a long TTL for static media)

### 4) Optional: lock down direct S3 access

If you want Cloudflare-only delivery:

- Keep bucket private and front with Cloudflare-supported private-origin pattern
- Or allow public read only for specific prefixes and rely on hard-to-guess object keys

Your current app route returns a public URL, so public delivery must work for those objects.

### 5) Verification

- Upload a file via app.
- Confirm response `publicUrl` starts with `https://media.yourdomain.com`.
- Open URL in browser and confirm it loads.
- Re-open to verify CDN cache hit behavior.
