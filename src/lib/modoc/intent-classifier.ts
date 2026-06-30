/**
 * Lightweight intent classification for VA routing (no extra LLM call).
 */

export type VaResponseMode = "conversational" | "production_protocol";

export type VaIntentCategory =
  | "general_knowledge"
  | "web_current_events"
  | "platform_production"
  | "platform_creative"
  | "platform_cross_module"
  | "tool_execution";

export type VaIntentClassification = {
  category: VaIntentCategory;
  responseMode: VaResponseMode;
  needsWebSearch: boolean;
  webSearchQuery?: string;
  confidence: number;
};

const WEB_SIGNALS =
  /\b(latest|current|today|tonight|this week|this month|2024|2025|2026|news|weather|exchange rate|stock price|who won|festival dates?|grant(s)?\s+(opportunit|program)|tax incentive|union update|industry trend|streaming trend|box office|awards?\s+\d{4}|how much does .+ cost|price of|release date|when did|recent(ly)?)\b/i;

const PLATFORM_SIGNALS =
  /\b(project|script|scene|budget|schedule|shoot day|call sheet|cast(ing)?|crew|contract|legal|expense|funding|breakdown|location|equipment|marketplace|dailies|continuity|incident|task|modoc_action|story time|storytime)\b/i;

const CROSS_MODULE_SIGNALS =
  /\b(which .+ (are|is) .+ (and|while|before)|attached to .+ over budget|unsigned .+ before|overspend(ing)? while|need(s)? signature|missing signature|forecast|burn rate|variance)\b/i;

const TOOL_SIGNALS =
  /\b(create|add|delete|remove|send|generate|build|schedule|assign|book|invite|log|capture|export|update my|set up|draft a contract|make a budget)\b/i;

const CREATIVE_SIGNALS =
  /\b(write|dialogue|logline|rewrite|brainstorm|pitch|synopsis|tagline|poster copy|scene variation|character bio)\b/i;

export function classifyVaIntent(
  userText: string,
  opts?: { hasProjectContext?: boolean; taskSlug?: string },
): VaIntentClassification {
  const text = userText.trim();
  const lower = text.toLowerCase();
  if (!text) {
    return {
      category: "general_knowledge",
      responseMode: "conversational",
      needsWebSearch: false,
      confidence: 0.5,
    };
  }

  const wantsWeb = WEB_SIGNALS.test(lower);
  const platform = PLATFORM_SIGNALS.test(lower) || !!opts?.taskSlug;
  const crossModule = CROSS_MODULE_SIGNALS.test(lower);
  const wantsTool = TOOL_SIGNALS.test(lower) && platform;
  const creative = CREATIVE_SIGNALS.test(lower);

  if (wantsTool && platform) {
    return {
      category: "tool_execution",
      responseMode: "production_protocol",
      needsWebSearch: wantsWeb,
      webSearchQuery: wantsWeb ? text : undefined,
      confidence: 0.85,
    };
  }

  if (crossModule && (platform || opts?.hasProjectContext)) {
    return {
      category: "platform_cross_module",
      responseMode: "production_protocol",
      needsWebSearch: wantsWeb,
      webSearchQuery: wantsWeb ? text : undefined,
      confidence: 0.8,
    };
  }

  if (platform || opts?.hasProjectContext) {
    if (creative) {
      return {
        category: "platform_creative",
        responseMode: "production_protocol",
        needsWebSearch: wantsWeb,
        webSearchQuery: wantsWeb ? text : undefined,
        confidence: 0.75,
      };
    }
    return {
      category: "platform_production",
      responseMode: "production_protocol",
      needsWebSearch: wantsWeb,
      webSearchQuery: wantsWeb ? text : undefined,
      confidence: 0.8,
    };
  }

  if (wantsWeb) {
    return {
      category: "web_current_events",
      responseMode: "conversational",
      needsWebSearch: true,
      webSearchQuery: text,
      confidence: 0.85,
    };
  }

  if (creative) {
    return {
      category: "platform_creative",
      responseMode: "conversational",
      needsWebSearch: false,
      confidence: 0.7,
    };
  }

  return {
    category: "general_knowledge",
    responseMode: "conversational",
    needsWebSearch: false,
    confidence: 0.9,
  };
}
