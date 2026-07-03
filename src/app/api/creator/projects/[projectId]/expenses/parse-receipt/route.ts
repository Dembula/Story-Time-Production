import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";

/** Heuristic receipt field extraction — flags low-confidence fields for review. */
export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | { ocrText?: string; fileName?: string; hintVendor?: string }
    | null;

  const text = `${body?.ocrText ?? ""}\n${body?.fileName ?? ""}`.trim();
  if (!text) {
    return NextResponse.json({ error: "ocrText or fileName required" }, { status: 400 });
  }

  const amountMatch =
    text.match(/(?:total|amount|balance|due)[:\s]*R?\s*([\d,]+\.?\d*)/i) ??
    text.match(/R\s*([\d,]+\.?\d*)/i);
  const vatMatch = text.match(/(?:vat|tax|gst)[:\s]*R?\s*([\d,]+\.?\d*)/i);
  const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{2}[-/]\d{2}[-/]\d{4})/);
  const receiptNo = text.match(/(?:receipt|invoice|ref)[#:\s]*([A-Z0-9-]+)/i);
  const vendor = body?.hintVendor ?? text.split("\n").find((l) => l.trim().length > 2)?.trim() ?? null;

  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const fields = {
    vendor: vendor ? { value: vendor.slice(0, 120), confidence: vendor === body?.hintVendor ? 0.9 : 0.55 } : null,
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

  return NextResponse.json({
    fields,
    needsReview,
    message: needsReview
      ? "Some fields need manual verification before saving."
      : "Receipt parsed — please confirm before logging.",
  });
}
