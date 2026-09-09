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

const SCREENPLAY_OCR_PROMPT = `You are extracting screenplay text from a PDF page image.
Read ONLY what is visibly printed. Do not invent scenes.

CRITICAL formatting rules — output must look like Final Draft / studio screenplay text:
1. Scene headings (INT./EXT. …) alone on their own line, then a blank line.
2. Action/description as normal sentences with correct English word spacing (never "tothe", "holdingMichaela", "DAYCROSS").
3. Character names alone on their own line in ALL CAPS — NO trailing colon (write "LISAKHANYA" not "LISAKHANYA:").
4. Dialogue on the line(s) under the character name.
5. Parentheticals like (V.O.) or (beat) on their own line between character and dialogue when present.
6. Transitions (FADE TO BLACK, CUT TO:) alone on their own line.
7. Do NOT include page numbers, CONTINUED, or MORE footers/headers.

Return ONLY the screenplay plain text for the requested page(s). No markdown, no commentary, no JSON.`;

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
      maxOutputTokens: 12_000,
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
    // Allow short/blank pages (title pages, nearly empty sheets).
    if (!cleaned) return "";
    if (/^(empty|blank|none|n\/a)$/i.test(cleaned)) return "";
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Vision OCR fallback when pdf-parse/pdfjs cannot extract usable text.
 * Multi-page PDFs are read page-by-page so later pages are never dropped.
 */
export async function extractScreenplayPdfWithVision(input: {
  pdfBase64: string;
  fileName?: string;
  pageHint?: string;
  /** Known PDF page count — used to run page-by-page extraction. */
  pageCount?: number;
}): Promise<{ text: string; method: string } | { error: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return { error: "OPENROUTER_API_KEY not configured for PDF vision OCR." };
  }

  const pages = Math.max(1, input.pageCount ?? 1);

  // Single-page (or unknown count): one full pass is fine.
  if (pages <= 1) {
    const text = await visionPass({
      pdfBase64: input.pdfBase64,
      extraHint: [
        input.pageHint,
        "Extract the complete screenplay text from this PDF.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    if (text == null || letterCount(text) < 40) {
      return { error: "Vision OCR returned insufficient screenplay text." };
    }
    return { text: truncateScriptText(text), method: "pdf-vision-ocr" };
  }

  // Page-by-page: models routinely stop after ~2–3 pages on whole-PDF OCR.
  const pageParts: string[] = [];
  for (let pageNum = 1; pageNum <= pages; pageNum += 1) {
    const pageText = await visionPass({
      pdfBase64: input.pdfBase64,
      extraHint: [
        input.pageHint,
        `This PDF has exactly ${pages} pages.`,
        `Extract ONLY page ${pageNum} of ${pages}.`,
        `Do not include text from pages other than ${pageNum}.`,
        `If page ${pageNum} has no dialogue/action, return an empty response.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (pageText == null) {
      // Retry once for a failed page call.
      const retry = await visionPass({
        pdfBase64: input.pdfBase64,
        extraHint: `Retry: extract ONLY the visible screenplay text on page ${pageNum} of ${pages}. Nothing else.`,
      });
      if (retry && retry.trim()) pageParts.push(retry.trim());
      continue;
    }
    if (pageText.trim()) pageParts.push(pageText.trim());
  }

  const joined = pageParts.join("\n\n").trim();
  const cleaned = truncateScriptText(joined);
  if (!cleaned || letterCount(cleaned) < 40) {
    return { error: "Vision OCR returned insufficient screenplay text." };
  }

  return { text: cleaned, method: "pdf-vision-ocr-paged" };
}
