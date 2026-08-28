/**
 * Financial & platform-economics guardrails for the creator VA.
 * Blocks sensitive forecasts; corrects common misinformation (e.g. 70/30 split).
 */

import {
  CREATOR_ONBOARDING_PLANS,
  CREATOR_PER_FILM_UPLOAD_PRICE,
  VIEWER_PLAN_CONFIG,
} from "@/lib/pricing";
import { VIEWER_CREATOR_SPLIT, VIEWER_PLATFORM_SPLIT } from "@/lib/payments/config";

export type FinancialGuardrailResult =
  | { kind: "none" }
  | { kind: "block"; reason: string; userMessage: string }
  | { kind: "policy"; policyBlock: string };

const BLOCK_PATTERNS: Array<{ pattern: RegExp; reason: string; userMessage: string }> = [
  {
    pattern:
      /\b(how much (could|can|will|would) my (film|short|movie|project|title).*(make|earn|generate|bring in)|what (will|would) i (make|earn) (on|from) (story ?time|the platform)|projected earnings? for my (film|short)|forecast (my )?revenue)\b/i,
    reason: "film_earnings_forecast",
    userMessage:
      "I can't forecast how much your film or short might earn on Story Time. Actual results depend on audience demand, marketing, completion quality, genre fit, and catalogue performance — and we don't publish title-level earnings projections.\n\nWhat I *can* help with: improving your project's readiness, distribution packaging, and pointing you to your own analytics once titles are live. Would you like help with any of that?",
  },
  {
    pattern:
      /\b(how much (is|does) story ?time (make|making|earn|earning|revenue|profit)|story ?time('s)? (total|overall|annual|yearly) (revenue|earnings|profit|turnover)|company (revenue|profit|earnings)|platform (total|gross) revenue|how profitable is story ?time|story ?time valuation|investor returns? for story ?time)\b/i,
    reason: "platform_internals",
    userMessage:
      "I don't have access to Story Time's internal financials, and I'm not able to share company-wide revenue, profit, or valuation figures.\n\nIf you're exploring the creator side, I can explain how the **public** creator relationship works — viewer plans, the revenue pool, and what shows up in **your** analytics dashboard once you're distributing.",
  },
  {
    pattern:
      /\b(how much do other creators (make|earn)|other (filmmakers|creators) (earnings|revenue)|average creator (income|earnings)|top earning (creator|film))\b/i,
    reason: "other_creators_earnings",
    userMessage:
      "I can't share other creators' earnings or rank titles by income — that's confidential to each rights holder.\n\nYour own performance data lives in **Creator Analytics** once you have live catalogue titles. I can help you interpret *your* numbers or improve a project's path to distribution.",
  },
  {
    pattern:
      /\b(guarantee(d)? (payout|income|revenue)|will i (definitely|for sure) (make|earn)|promise(d)? (earnings|revenue))\b/i,
    reason: "earnings_guarantee",
    userMessage:
      "Story Time doesn't guarantee specific earnings for any project. Creator payouts come from the viewer revenue pool and depend on paid watch time, catalogue performance, and your distribution terms.\n\nI can walk you through how the pool works at a high level, or help you get your project ready for a stronger launch.",
  },
];

const REVENUE_SPLIT_PATTERNS =
  /\b(revenue split|rev[\s-]?share|creator split|platform split|what (percent|percentage|%) (do|does) (i|creators) (get|keep|receive)|70\s*\/\s*30|70\s*%\s*\/\s*30\s*%|how (does|do) (creator )?payouts? work)\b/i;

const PUBLIC_CREATOR_ECONOMICS = `
## Story Time creator economics (public — use these facts, never invent others)

**Viewer revenue pool (catalogue):**
- ${Math.round(VIEWER_CREATOR_SPLIT * 100)}% of the **net viewer pool** is allocated to creators, split **proportionally by eligible paid watch time** (not free-trial viewing).
- ${Math.round(VIEWER_PLATFORM_SPLIT * 100)}% supports platform operations, streaming, payments, and product development.
- **Never say 70/30** — that is incorrect for Story Time.

**PPV (pay-per-view):** Viewers can rent individual titles; access window is limited after purchase (see product copy). PPV flows into creator compensation per published terms — do not invent per-title dollar amounts.

**Creator plans (onboarding — public list prices in ZAR):**
- Pay per film: R${CREATOR_PER_FILM_UPLOAD_PRICE} per catalogue submission.
- Catalogue unlimited (year): R${CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price}/year.
- Full pipeline (year): R${CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price}/year.
- Full pipeline (month): R${CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price}/month.

**Viewer subscription plans (public, ZAR):** Basic R${VIEWER_PLAN_CONFIG.BASE_1.price}, Standard R${VIEWER_PLAN_CONFIG.STANDARD_3.price}, Premium R${VIEWER_PLAN_CONFIG.FAMILY_5.price}, PPV from R${VIEWER_PLAN_CONFIG.PPV_FILM.price}.

**What you MAY discuss:** The user's own analytics (when in context), public plan pricing, how the pool works conceptually, production budgeting for *their* project.
**What you MUST NOT discuss:** Title-level earnings forecasts, platform total revenue/profit, other creators' income, guaranteed returns, internal fee schedules beyond public transaction labels.
`.trim();

export function evaluateFinancialGuardrail(userText: string): FinancialGuardrailResult {
  const text = userText.trim();
  if (!text) return { kind: "none" };

  for (const rule of BLOCK_PATTERNS) {
    if (rule.pattern.test(text)) {
      return { kind: "block", reason: rule.reason, userMessage: rule.userMessage };
    }
  }

  if (REVENUE_SPLIT_PATTERNS.test(text)) {
    return {
      kind: "policy",
      policyBlock: `${PUBLIC_CREATOR_ECONOMICS}

The user is asking about revenue splits or payout mechanics. Answer in warm, plain language using the facts above. If they mentioned 70/30, gently correct it. Do NOT use OBSERVATION/REASONING headers.`,
    };
  }

  return { kind: "none" };
}

export function buildFinancialGuardrailPromptBlock(result: FinancialGuardrailResult): string {
  if (result.kind === "block") {
    return `
## MANDATORY RESPONSE (sensitive financial query — highest priority)
The user asked something you must **not** answer with numbers, forecasts, or platform internals.

Respond in a **warm, human, conversational** tone. Do **NOT** use OBSERVATION / REASONING / ACTION headers.

Your reply must convey the substance below (you may personalise the greeting, but keep the refusal clear):

${result.userMessage}
`.trim();
  }
  if (result.kind === "policy") {
    return `\n\n${result.policyBlock}`;
  }
  return "";
}
