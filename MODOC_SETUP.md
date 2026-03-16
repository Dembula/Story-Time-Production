# MODOC setup and going live

## MODOC (OpenRouter) API key

MODOC uses [OpenRouter](https://openrouter.ai) so you can use 400+ models (OpenAI, Claude, Gemini, etc.) with one API key.

1. **Put your key in `.env.local`** (this file is gitignored; never commit real keys).

   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
   ```

2. **Optional:** Change the model MODOC uses (default is `openai/gpt-4o-mini`):

   ```env
   OPENROUTER_MODOC_MODEL=anthropic/claude-3.5-sonnet
   ```

   See [OpenRouter models](https://openrouter.ai/models) for IDs like `google/gemini-2.0-flash`, `anthropic/claude-3.5-sonnet`, etc.

3. **Security:** If you ever paste your API key in chat or in a file that gets committed, **rotate the key** in [OpenRouter Keys](https://openrouter.ai/keys) and update `.env.local`.

---

## Going live (deployment)

**Cursor** is your code editor. It does **not** provide hosting or “live” server keys. To put the platform live you need:

1. **A hosting provider** (e.g. [Vercel](https://vercel.com), Railway, Render).
2. **Environment variables** set in that provider’s dashboard (not in Cursor), including:
   - `OPENROUTER_API_KEY` (for MODOC)
   - `DATABASE_URL` / `DIRECT_URL` (e.g. Neon Postgres)
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (production URL)
   - Any OAuth keys (Google, GitHub) if you use them in production
   - Storage keys if you use S3/R2

3. **No Cursor-specific keys** are required to run the app in production. Cursor is only for editing and building the project locally.

**Typical flow:** Push your repo to GitHub, connect the repo to Vercel (or another host), add the env vars in the project’s **Settings → Environment variables**, then deploy. The same `OPENROUTER_API_KEY` and other vars you use locally should be set there (with production values where needed).
