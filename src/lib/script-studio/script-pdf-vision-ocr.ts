import "server-only";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { modelsForTask } from "@/lib/modoc/model-router";
import { truncateScriptText } from "@/lib/ai-metadata/screenplay-format-extract";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const SCREENPLAY_OCR_PROMPT = `You are extracting screenplay text from a scanned or image-based PDF page.
Return ONLY the screenplay content as plain text in standard screenplay layout:
- Scene headings (INT./EXT.) on their own lines
- Character names centered (ALL CAPS) above dialogue
- Action lines as paragraphs
Do not add commentary, markdown, or JSON. Preserve page order if multiple pages are shown.`;

/**
 * Vision OCR fallback when pdf-parse/pdfjs cannot extract text (scanned PDFs).
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
