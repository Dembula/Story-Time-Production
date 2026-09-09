import "server-only";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { modelsForTask } from "@/lib/modoc/model-router";
import { truncateScriptText } from "@/lib/ai-metadata/screenplay-format-extract";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

function letterCount(text: string): number {
  return text.replace(/[^A-Za-z]/g, "").length;
}

const SCREENPLAY_OCR_PROMPT = `You are extracting a COMPLETE screenplay from a PDF.
Read ONLY what is visibly printed. Do not invent scenes.

CRITICAL — completeness:
- Transcribe EVERY page from first to last. Do not stop early.
- If the PDF has N pages, your output must cover all N pages.
- Never summarize, skip, or omit later pages.

CRITICAL formatting rules — output must look like Final Draft / studio screenplay text:
1. Scene headings (INT./EXT. …) alone on their own line, then a blank line.
2. Action/description as normal sentences with correct English word spacing (never "tothe", "holdingMichaela", "DAYCROSS").
3. Character names alone on their own line in ALL CAPS — NO trailing colon.
4. Dialogue on the line(s) under the character name.
5. Parentheticals like (V.O.) or (beat) on their own line between character and dialogue when present.
6. Transitions (FADE TO BLACK, CUT TO:) alone on their own line.
7. Preserve blank lines between blocks. Preserve reading order across pages.

Return ONLY the screenplay plain text. No markdown, no commentary, no JSON.`;

async function visionPass(input: {
  pdfBase64: string;
  extraHint?: string;
}): Promise<string | null> {
  const models = modelsForTask("extraction");
  const modelId = models[0] ?? "google/gemini-2.0-flash-001";
  const mime = "application/pdf";

  try {
    const { text } = await generateText({
      model: openRouter.chat(modelId),
      maxOutputTokens: 48_000,
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
            ...(input.extraHint
              ? [{ type: "text" as const, text: input.extraHint }]
              : []),
          ],
        },
      ],
    });
    const cleaned = text.trim();
    return cleaned && letterCount(cleaned) >= 40 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * Vision OCR fallback when pdf-parse/pdfjs cannot extract usable text
 * (scanned PDFs or corrupt ToUnicode / CID font text layers).
 *
 * Always aims for full-document coverage — models often stop after early pages,
 * so we continue with a second pass when output looks short for the page count.
 */
export async function extractScreenplayPdfWithVision(input: {
  pdfBase64: string;
  fileName?: string;
  pageHint?: string;
  /** Known PDF page count — used to detect cropped OCR output. */
  pageCount?: number;
}): Promise<{ text: string; method: string } | { error: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return { error: "OPENROUTER_API_KEY not configured for PDF vision OCR." };
  }

  const pages = Math.max(1, input.pageCount ?? 1);
  const baseHint = [
    input.pageHint,
    pages > 1
      ? `This PDF has ${pages} pages. You MUST extract all ${pages} pages completely — do not stop after page 1–3.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  let text = await visionPass({
    pdfBase64: input.pdfBase64,
    extraHint: baseHint || undefined,
  });

  if (!text) {
    return { error: "Vision OCR returned insufficient screenplay text." };
  }

  // Rough floor: a lettered screenplay page usually has well over ~400 letters.
  const minLetters = pages > 1 ? pages * 400 : 40;
  if (letterCount(text) < minLetters && pages > 1) {
    const continuation = await visionPass({
      pdfBase64: input.pdfBase64,
      extraHint: [
        `This PDF has ${pages} pages. The previous extract stopped early.`,
        `Continue from AFTER this ending (do not repeat it). Extract ONLY the remaining pages through page ${pages}:`,
        "-----",
        text.slice(Math.max(0, text.length - 1800)),
        "-----",
      ].join("\n"),
    });
    if (continuation && letterCount(continuation) >= 40) {
      text = `${text.trim()}\n\n${continuation.trim()}`;
    }
  }

  const cleaned = truncateScriptText(text.trim());
  if (!cleaned || letterCount(cleaned) < 40) {
    return { error: "Vision OCR returned insufficient screenplay text." };
  }

  return { text: cleaned, method: "pdf-vision-ocr" };
}
