import "server-only";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { modelsForTask } from "@/lib/modoc/model-router";
import { truncateScriptText } from "@/lib/ai-metadata/screenplay-format-extract";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const SCREENPLAY_OCR_PROMPT = `You are extracting a screenplay from a PDF page image.
Read ONLY what is visibly printed. Do not invent scenes.

CRITICAL formatting rules — output must look like Final Draft / studio screenplay text:
1. Scene headings (INT./EXT. …) alone on their own line, then a blank line.
2. Action/description as normal sentences with correct English word spacing (never "tothe", "holdingMichaela", "DAYCROSS").
3. Character names alone on their own line in ALL CAPS — NO trailing colon.
4. Dialogue on the line(s) under the character name.
5. Parentheticals like (V.O.) or (beat) on their own line between character and dialogue when present.
6. Transitions (FADE TO BLACK, CUT TO:) alone on their own line.
7. Preserve blank lines between blocks. Preserve reading order across pages.

Return ONLY the screenplay plain text. No markdown, no commentary, no JSON.`;

/**
 * Vision OCR fallback when pdf-parse/pdfjs cannot extract usable text
 * (scanned PDFs or corrupt ToUnicode / CID font text layers).
 */
export async function extractScreenplayPdfWithVision(input: {
  pdfBase64: string;
  fileName?: string;
  pageHint?: string;
}): Promise<{ text: string; method: string } | { error: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return { error: "OPENROUTER_API_KEY not configured for PDF vision OCR." };
  }

  const models = modelsForTask("extraction");
  const modelId = models[0] ?? "google/gemini-2.0-flash-001";
  const mime = "application/pdf";

  try {
    const { text } = await generateText({
      model: openRouter.chat(modelId),
      maxOutputTokens: 16_000,
      temperature: 0.05,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SCREENPLAY_OCR_PROMPT },
            {
              type: "image",
              image: `data:${mime};base64,${input.pdfBase64}`,
            },
            ...(input.pageHint
              ? [{ type: "text" as const, text: `Context: ${input.pageHint}` }]
              : []),
          ],
        },
      ],
    });

    const cleaned = truncateScriptText(text.trim());
    if (!cleaned || cleaned.replace(/[^A-Za-z]/g, "").length < 40) {
      return { error: "Vision OCR returned insufficient screenplay text." };
    }

    return { text: cleaned, method: "pdf-vision-ocr" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Vision OCR failed." };
  }
}
