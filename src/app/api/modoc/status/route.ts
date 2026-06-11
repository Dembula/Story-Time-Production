import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    available: Boolean(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODOC_MODEL ?? "openai/gpt-4o-mini",
  });
}
