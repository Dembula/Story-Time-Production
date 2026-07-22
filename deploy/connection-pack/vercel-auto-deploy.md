# Fix: pushes from Cursor/GitHub not deploying on Vercel

Your commits were reaching GitHub, but Vercel was not creating builds
(broken Git webhook / pending authorization). This repo now includes a
**GitHub Action** that forces a production deploy on every `main` push.

## One-time setup (do this once — ~3 minutes)

### A) Create a Vercel Deploy Hook

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **Story Time** project  
2. **Settings** → **Git**  
3. Scroll to **Deploy Hooks**  
4. Create hook:
   - Name: `github-main`
   - Branch: `main`
5. **Copy the hook URL** (keep it secret)

### B) Add the secret on GitHub

1. GitHub → `Dembula/Story-Time-Production` → **Settings** → **Secrets and variables** → **Actions**  
2. **New repository secret**
   - Name: `VERCEL_DEPLOY_HOOK_URL`
   - Value: paste the Deploy Hook URL  
3. Save

### C) Reconnect native Git (recommended)

Still do this so Vercel’s normal Git integration works again:

1. Vercel → Project → **Settings** → **Git**  
2. **Disconnect** the repository  
3. **Connect** again → choose `Dembula/Story-Time-Production`  
4. Production Branch = `main`  
5. GitHub → **Settings** → **Applications** → **Vercel** → ensure this repo is allowed

### D) Authorize if Vercel asks

If Deployments show **Pending authorization** (common after `vercel.json` / env changes on public repos), click **Authorize**.

---

## After setup

Every push to `main` (including from Cursor) will:

1. Run `.github/workflows/deploy-vercel.yml`
2. POST the Deploy Hook
3. Start a Production build in Vercel

You can also run it manually: GitHub → **Actions** → **Deploy production to Vercel** → **Run workflow**.

---

## Optional: CLI deploy fallback

If the Deploy Hook fails, add these GitHub secrets too (from Vercel → Account → Tokens / Project Settings):

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID` (also in `.vercel/project.json` after `vercel link`)
- `VERCEL_PROJECT_ID`

The workflow’s second job will deploy via CLI when the hook job fails and these secrets exist.
