# MediaConvert auto-compress (high-bitrate → Stream-safe)

Cloudflare Stream **rejects** inputs averaging over **~200 Mbps** (ProRes / uncompressed / camera masters).

With MediaConvert enabled, Story Time:

1. Uploads the original master to S3 (multipart, up to ~50GB)
2. Detects high bitrate
3. Compresses to an H.264 mezzanine (~40 Mbps max) via **AWS Elemental MediaConvert**
4. Ingests the mezzanine into **Cloudflare Stream** for adaptive playback

Original masters stay in `uploads/`; mezzanines land under `mezzanine/`.

---

## Cost (approx.)

MediaConvert bills per output minute (region/tier dependent). Rough ballpark for HD mezzanine is on the order of **a few cents per minute of video**. A 2-hour feature is typically a few dollars per encode — check the [MediaConvert pricing page](https://aws.amazon.com/mediaconvert/pricing/) for your region.

---

## Fastest setup (AWS Console, ~10 minutes)

### A) Create the MediaConvert service role

**Option 1 — CloudFormation (recommended)**

1. Open [CloudFormation](https://console.aws.amazon.com/cloudformation) in the **same region** as your S3 bucket (`STORAGE_REGION`).
2. **Create stack** → Upload template file:  
   `deploy/connection-pack/mediaconvert-cloudformation.json`
3. Parameters:
   - `BucketName` = your `STORAGE_BUCKET_NAME`
   - `RoleName` = `StorytimeMediaConvertRole` (default)
   - `AppUserName` = your uploader IAM user (e.g. `storytime-uploader`) — so API permissions attach automatically
4. Acknowledge IAM capabilities → Create
5. Outputs → copy **`MediaConvertRoleArn`**

**Option 2 — MediaConvert console wizard**

1. Open [MediaConvert → Jobs → Create job](https://console.aws.amazon.com/mediaconvert)
2. Job settings → AWS integration → **Create a new service role, configure permissions**
3. Restrict input/output S3 locations to your media bucket (`uploads/*` in, `mezzanine/*` out)
4. Copy the role ARN (or rename/use `StorytimeMediaConvertRole`)

### B) Grant the app user MediaConvert API access

If CloudFormation did **not** attach to your uploader user:

1. IAM → Users → `storytime-uploader` (or whatever holds `STORAGE_ACCESS_KEY_ID`)
2. Add permissions → Create inline / attach policy from:  
   `deploy/connection-pack/iam-policy-storytime-mediaconvert-api.json`
3. Replace `YOUR_ACCOUNT_ID`, `YOUR_BUCKET_NAME`, and the role name if different
4. Also update the existing uploader S3 policy to allow `mezzanine/*` read (see updated `iam-policy-storytime-uploader.json`)

### C) Vercel environment variables

Add to **Production** (and Preview if you test there):

```
MEDIACONVERT_ROLE_ARN=arn:aws:iam::ACCOUNT:role/StorytimeMediaConvertRole
MEDIACONVERT_REGION=YOUR_STORAGE_REGION
NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED=true
```

Optional (auto-discovered if omitted):

```
MEDIACONVERT_ENDPOINT=https://....amazonaws.com
MEDIACONVERT_QUEUE_ARN=arn:aws:mediaconvert:...:queues/Default
```

Redeploy the project after saving env vars.

### D) Confirm cron

`vercel.json` already schedules `/api/cron/stream-mezzanine` every 5 minutes (needs `CRON_SECRET` as today). That finishes mezzanine jobs and starts Stream ingest.

---

## Scripted setup (admin AWS keys)

If your keys can create IAM / CloudFormation:

```powershell
$env:STORAGE_BUCKET_NAME="your-bucket"
$env:STORAGE_REGION="af-south-1"
$env:STORAGE_ACCESS_KEY_ID="AKIA..."
$env:STORAGE_SECRET_ACCESS_KEY="..."
$env:MEDIACONVERT_SETUP_APP_USER="storytime-uploader"
npx tsx scripts/setup-mediaconvert.ts
```

Paste the printed values into Vercel, then redeploy.

---

## After it’s live

| Upload | What happens |
|--------|----------------|
| H.264 under ~180 Mbps | Direct Stream ingest (fast path) |
| ProRes / >180 Mbps master | Auto MediaConvert mezzanine → Stream |
| MediaConvert not configured | Upload UI blocks >180 Mbps with HandBrake guidance |

Admin **Approve** on a previously failed bitrate encode will **re-queue mezzanine** once `MEDIACONVERT_ROLE_ARN` is set.

---

## Verify

1. Upload a short high-bitrate test clip (or re-approve the failed film)
2. Check AWS MediaConvert → Jobs (should show PROGRESSING → COMPLETE)
3. Check StreamAsset / admin encode messages (`mezzanining` then Stream `queued`/`ready`)
4. Playback works via Stream HLS (S3 progressive fallback while encoding)
