import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { modelsForTask } from "@/lib/modoc/model-router";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

export type ReceiptVisionField = {
  value: unknown;
  confidence: number;
};

export type ReceiptVisionResult = {
  ocrText: string;
  fields: {
    vendor: ReceiptVisionField | null;
    amount: ReceiptVisionField | null;
    vatAmount: ReceiptVisionField | null;
    spentAt: ReceiptVisionField | null;
    receiptNumber: ReceiptVisionField | null;
    paymentMethod: ReceiptVisionField | null;
  };
  needsReview: boolean;
  source: "vision" | "heuristic";
};

const RECEIPT_JSON_SCHEMA = `Return ONLY valid JSON:
{
  "vendor": string | null,
  "amount": number | null,
  "vatAmount": number | null,
  "spentAt": "YYYY-MM-DD" | null,
  "receiptNumber": string | null,
  "paymentMethod": "CASH" | "CARD" | "EFT" | "OTHER" | null,
  "ocrText": string
}`;

export async function extractReceiptWithVision(input: {
  imageUrl?: string | null;
  imageBase64?: string | null;
  mimeType?: string;
  fileName?: string;
  hintVendor?: string;
}): Promise<ReceiptVisionResult | { error: string }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { error: "OPENROUTER_API_KEY not configured" };
  }

  const models = modelsForTask("extraction");
  const modelId = models[0] ?? "google/gemini-2.0-flash-001";

  const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL | string }> = [
    {
      type: "text",
      text: `Extract receipt fields for a South African production expense. ${RECEIPT_JSON_SCHEMA}`,
    },
  ];

  if (input.imageUrl) {
    content.push({ type: "image", image: new URL(input.imageUrl) });
  } else if (input.imageBase64) {
    const mime = input.mimeType ?? "image/jpeg";
    content.push({ type: "image", image: `data:${mime};base64,${input.imageBase64}` });
  } else if (input.fileName) {
    content.push({ type: "text", text: `Filename only (no image): ${input.fileName}` });
  } else {
    return { error: "imageUrl, imageBase64, or fileName required" };
  }

  try {
    const { text } = await generateText({
      model: openRouter.chat(modelId),
      maxOutputTokens: 2000,
      temperature: 0.1,
      messages: [{ role: "user", content }],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "Vision model returned no JSON" };

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const ocrText = String(parsed.ocrText ?? text.slice(0, 4000));

    const field = (key: string, conf = 0.85): ReceiptVisionField | null => {
      const v = parsed[key];
      if (v == null || v === "") return null;
      return { value: v, confidence: conf };
    };

    const fields = {
      vendor: input.hintVendor ? { value: input.hintVendor, confidence: 0.9 } : field("vendor", 0.82),
      amount: field("amount", 0.88),
      vatAmount: field("vatAmount", 0.8),
      spentAt: field("spentAt", 0.78),
      receiptNumber: field("receiptNumber", 0.85),
      paymentMethod: field("paymentMethod", 0.8),
    };

    const needsReview = Object.values(fields).some((f) => f && f.confidence < 0.75);

    return { ocrText, fields, needsReview, source: "vision" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Vision OCR failed" };
  }
}
