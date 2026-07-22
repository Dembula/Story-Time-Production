# Fix: pushes not creating Vercel builds

Your Deploy Hook can show **green on GitHub** while Vercel never starts a build
(known when Git integration/webhooks are broken). Use **Vercel CLI from GitHub Actions** instead — it uploads and deploys directly.

## One-time setup (~5 minutes)

### 1) Create a Vercel token

1. [vercel.com/account/tokens](https://vercel.com/account/tokens)  
2. Create → name `github-actions` → copy token  

### 2) Copy Project ID + Team/Org ID

1. Vercel → your Story Time project → **Settings** → **General**  
2. Copy **Project ID** → this is `VERCEL_PROJECT_ID`  
3. Copy **Team ID** (or for Hobby personal account, the account/team id shown there) → `VERCEL_ORG_ID`  

If unsure about Org ID: after installing Vercel CLI locally you can run `vercel link` and read `.vercel/project.json` (`orgId` / `projectId`).

### 3) Add three **repository** secrets on GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Name | Value |
|------|--------|
| `VERCEL_TOKEN` | token from step 1 |
| `VERCEL_ORG_ID` | Team/Org ID |
| `VERCEL_PROJECT_ID` | Project ID |

You can leave or delete `VERCEL_DEPLOY_HOOK_URL` — the workflow no longer needs it.

### 4) Run the workflow

GitHub → **Actions** → **Deploy production to Vercel** → **Run workflow**

Watch the job logs. When it finishes, Vercel → **Deployments** should show a new **Production** deployment with a URL.

### 5) (Optional) Reconnect Git in Vercel

So the dashboard Git integration works again too:

1. Vercel → Project → **Settings** → **Git** → Disconnect → Connect `Dembula/Story-Time-Production`  
2. Production branch = `main`  
3. Authorize any “Pending authorization” deployments  

---

After this, every Cursor push to `main` runs the Action and deploys to Production.
