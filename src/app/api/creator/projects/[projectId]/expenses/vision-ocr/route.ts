import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { extractReceiptWithVision } from "@/lib/financial-ops/receipt-vision-ocr";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

function heuristicParse(text: string, hintVendor?: string) {
  const amountMatch =
    text.match(/(?:total|amount|balance|due)[:\s]*R?\s*([\d,]+\.?\d*)/i) ??
    text.match(/R\s*([\d,]+\.?\d*)/i);
  const vatMatch = text.match(/(?:vat|tax|gst)[:\s]*R?\s*([\d,]+\.?\d*)/i);
  const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{2}[-/]\d{2}[-/]\d{4})/);
  const receiptNo = text.match(/(?:receipt|invoice|ref)[#:\s]*([A-Z0-9-]+)/i);
  const vendor = hintVendor ?? text.split("\n").find((l) => l.trim().length > 2)?.trim() ?? null;
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;

  const fields = {
    vendor: vendor ? { value: vendor.slice(0, 120), confidence: hintVendor ? 0.9 : 0.55 } : null,
    amount: amount != null && Number.isFinite(amount) ? { value: amount, confidence: 0.7 } : null,
    vatAmount: vatMatch ? { value: Number(vatMatch[1].replace(/,/g, "")), confidence: 0.65 } : null,
    spentAt: dateMatch ? { value: dateMatch[0], confidence: 0.6 } : null,
    receiptNumber: receiptNo ? { value: receiptNo[1], confidence: 0.75 } : null,
    paymentMethod: /card|visa|mastercard/i.test(text)
      ? { value: "CARD" as const, confidence: 0.8 }
      : /cash/i.test(text)
        ? { value: "CASH" as const, confidence: 0.75 }
        : null,
  };
  const needsReview = Object.values(fields).some((f) => f && f.confidence < 0.7);
  return { fields, needsReview, ocrText: text, source: "heuristic" as const };
}

/** AI vision OCR + heuristic fallback for receipt field extraction. */
export async function POST(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  // Project membership required — this endpoint spends vision-model credits.
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const limited = await enforceUserRateLimit({
    key: "expense-vision-ocr",
    userId: access.userId,
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = (await _req.json().catch(() => null)) as {
    imageUrl?: string;
    imageBase64?: string;
    mimeType?: string;
    fileName?: string;
    hintVendor?: string;
    ocrText?: string;
  } | null;

  if (body?.imageUrl || body?.imageBase64) {
    const result = await extractReceiptWithVision(body);
    if ("error" in result) {
      const fallback = heuristicParse(body.fileName ?? "", body.hintVendor);
      return NextResponse.json({
        ...fallback,
        message: `Vision unavailable (${result.error}). Heuristic fallback used.`,
      });
    }
    return NextResponse.json({
      fields: result.fields,
      ocrText: result.ocrText,
      needsReview: result.needsReview,
      source: result.source,
      message: result.needsReview ? "Review flagged fields before saving." : "Receipt scanned successfully.",
    });
  }

  const text = `${body?.ocrText ?? ""}\n${body?.fileName ?? ""}`.trim();
  if (!text) return NextResponse.json({ error: "imageUrl, imageBase64, or ocrText required" }, { status: 400 });

  const parsed = heuristicParse(text, body?.hintVendor);
  return NextResponse.json({
    ...parsed,
    message: parsed.needsReview ? "Some fields need manual verification." : "Receipt parsed.",
  });
}
