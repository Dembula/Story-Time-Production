import { NextResponse } from "next/server";
import { modelsForTask } from "@/lib/modoc/model-router";

export async function GET() {
  const configured = Boolean(process.env.OPENROUTER_API_KEY);
  return NextResponse.json({
    available: configured,
    provider: "openrouter",
    defaultModel: process.env.OPENROUTER_MODOC_MODEL ?? "openai/gpt-4o-mini",
    routing: configured
      ? {
          creative: modelsForTask("creative"),
          extraction: modelsForTask("extraction"),
          logic: modelsForTask("logic"),
          chat: modelsForTask("chat"),
        }
      : null,
    envOverrides: {
      creative: process.env.OPENROUTER_MODOC_CREATIVE_MODEL ?? null,
      extraction: process.env.OPENROUTER_MODOC_EXTRACTION_MODEL ?? null,
      logic: process.env.OPENROUTER_MODOC_LOGIC_MODEL ?? null,
      chat: process.env.OPENROUTER_MODOC_CHAT_MODEL ?? null,
    },
  });
}
