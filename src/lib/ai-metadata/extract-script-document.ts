import "server-only";

import { isAllowedStorageUrl } from "@/lib/storage-origin";

const MAX_SCRIPT_BYTES = 15 * 1024 * 1024;
const MAX_SCRIPT_CHARS = 120_000;

function truncateScriptText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_SCRIPT_CHARS) return normalized;
  return `${normalized.slice(0, MAX_SCRIPT_CHARS)}\n\n[…script truncated for analysis…]`;
}

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();
    return truncateScriptText(textResult.text ?? "");
  } catch (err) {
    console.error("PDF script extraction failed:", err);
    return null;
  }
}

/** Fetch an uploaded script document (PDF, plain text, Fountain) and return screenplay text. */
export async function fetchScriptTextFromUrl(url: string): Promise<string | null> {
  if (!isAllowedStorageUrl(url)) return null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_SCRIPT_BYTES) return null;

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const lower = url.toLowerCase();

    if (contentType === "application/pdf" || lower.endsWith(".pdf") || buf.slice(0, 5).toString() === "%PDF-") {
      return await extractPdfText(buf);
    }

    if (
      contentType.startsWith("text/") ||
      lower.endsWith(".txt") ||
      lower.endsWith(".fountain") ||
      lower.endsWith(".fdx")
    ) {
      return truncateScriptText(buf.toString("utf8"));
    }

    return truncateScriptText(buf.toString("utf8"));
  } catch (err) {
    console.error("Script fetch failed:", err);
    return null;
  }
}
