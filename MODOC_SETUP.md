# MODOC setup and going live

## MODOC (OpenRouter) API key

MODOC uses [OpenRouter](https://openrouter.ai) so you can use 400+ models (OpenAI Astra, Claude Opus, Gemini, etc.) with **one API key**.

1. **Put your key in `.env.local`** (gitignored; never commit real keys).

   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
   ```

2. **Strong defaults are baked into code** (no extra env required after deploy):

   | Kind | Primary → fallbacks |
   |------|---------------------|
   | creative | `openai/gpt-6-astra` → `anthropic/claude-opus-5.5` → `anthropic/claude-sonnet-5.5` |
   | extraction | `openai/gpt-6-astra` → `google/gemini-2.5-flash` → `openai/gpt-4o-mini` |
   | logic | `openai/gpt-6-astra-pro` → `anthropic/claude-opus-5.5` → `openai/gpt-6-astra` |
   | chat | `openai/gpt-6-astra` → `anthropic/claude-sonnet-5.5` → `google/gemini-2.5-flash` |
   | power | `openai/gpt-6-astra-pro` → `anthropic/claude-opus-5.5` → `openai/gpt-6-astra` |

3. **Optional overrides** (OpenRouter model slugs, not extra keys):

   ```env
   OPENROUTER_MODOC_MODEL=openai/gpt-6-astra
   OPENROUTER_MODOC_CREATIVE_MODEL=openai/gpt-6-astra
   OPENROUTER_MODOC_EXTRACTION_MODEL=openai/gpt-6-astra
   OPENROUTER_MODOC_LOGIC_MODEL=openai/gpt-6-astra-pro
   OPENROUTER_MODOC_CHAT_MODEL=openai/gpt-6-astra
   OPENROUTER_MODOC_POWER_MODEL=openai/gpt-6-astra-pro
   ```

   Short aliases also work: `astra`, `astra-pro`, `claude-opus-5.5`, `claude-sonnet-5.5`.

   Check config at `/api/modoc/status` after deploy.

   See [OpenRouter models](https://openrouter.ai/models) for current IDs.

4. **Security:** If you ever paste your API key in chat or a committed file, **rotate the key** in [OpenRouter Keys](https://openrouter.ai/keys) and update `.env.local` + Vercel.

---

## Vercel environment variables (required)

In **Vercel → Project → Settings → Environment Variables**, set for **Production** (and Preview if you want):

| Name | Value | Notes |
|------|--------|--------|
| `OPENROUTER_API_KEY` | `sk-or-v1-…` | **Required.** Same key as local. Enable the models on your OpenRouter account / billing. |
| `OPENROUTER_MODOC_MODEL` | `openai/gpt-6-astra` | Optional global head of every chain |
| `OPENROUTER_MODOC_CREATIVE_MODEL` | `openai/gpt-6-astra` | Optional |
| `OPENROUTER_MODOC_EXTRACTION_MODEL` | `openai/gpt-6-astra` | Optional |
| `OPENROUTER_MODOC_LOGIC_MODEL` | `openai/gpt-6-astra-pro` | Optional (stronger / costlier) |
| `OPENROUTER_MODOC_CHAT_MODEL` | `openai/gpt-6-astra` | Optional |
| `OPENROUTER_MODOC_POWER_MODEL` | `openai/gpt-6-astra-pro` | Optional — heavy tools / storyboard planning |
| `OPENROUTER_STORYBOARD_PLAN_MODEL` | `openai/gpt-6-astra` | Optional — Astra plans shot prompts |
| `OPENROUTER_STORYBOARD_IMAGE_MODEL` | `openai/gpt-image-2.5-sunburst` | Optional — primary frame drawing model |

**Minimum to go live with the upgrade:** only `OPENROUTER_API_KEY` — code defaults already use Astra + Opus (and strong image fallbacks for Storyboard Studio).

**OpenRouter account checklist**
1. Add credits / payment method so `gpt-6-astra`, `gpt-6-astra-pro`, and `claude-opus-5.5` are callable.
2. If a model is blocked for your account, MODOC probes and falls through the chain automatically.

Redeploy after changing env vars.

---

## Going live (deployment)

**Cursor** is your code editor. It does **not** provide hosting. To put the platform live:

1. **Hosting** (e.g. [Vercel](https://vercel.com)).
2. **Environment variables** in that provider’s dashboard, including:
   - `OPENROUTER_API_KEY` (for MODOC)
   - `DATABASE_URL` / `DIRECT_URL` (Neon Postgres)
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (production URL)
   - OAuth / storage keys as needed

3. **No Cursor-specific keys** are required in production.

**Typical flow:** Push to GitHub → Vercel deploys → set env vars → verify `/api/modoc/status`.
