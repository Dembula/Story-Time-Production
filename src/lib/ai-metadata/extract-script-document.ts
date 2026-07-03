import "server-only";

import mammoth from "mammoth";
import { isAllowedStorageUrl } from "@/lib/storage-origin";

const MAX_SCRIPT_BYTES = 15 * 1024 * 1024;
const MAX_SCRIPT_CHARS = 120_000;

export type ScriptFileExtraction = {
  text: string;
  sourceType: "pdf" | "docx" | "text";
  error?: string;
};

function truncateScriptText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_SCRIPT_CHARS) return normalized;
  return `${normalized.slice(0, MAX_SCRIPT_CHARS)}\n\n[…script truncated for import…]`;
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

function detectUploadType(filename: string, mimeType: string, buffer: Buffer): ScriptFileExtraction["sourceType"] | "unsupported" {
  const lower = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf") || lower.endsWith(".pdf") || buffer.slice(0, 5).toString() === "%PDF-") {
    return "pdf";
  }
  if (mime.includes("wordprocessingml") || lower.endsWith(".docx")) {
    return "docx";
  }
  if (
    mime.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".fountain") ||
    lower.endsWith(".fdx")
  ) {
    return "text";
  }
  return "unsupported";
}

/** Extract screenplay text from an uploaded file buffer (import / analysis). */
export async function extractScreenplayFromFileBuffer(
  buffer: Buffer,
  filename: string,
  mimeType = "",
): Promise<ScriptFileExtraction> {
  if (buffer.byteLength === 0) {
    return { text: "", sourceType: "text", error: "File is empty." };
  }
  if (buffer.byteLength > MAX_SCRIPT_BYTES) {
    return { text: "", sourceType: "text", error: "File is too large to import (max 15MB)." };
  }

  const kind = detectUploadType(filename, mimeType, buffer);
  if (kind === "unsupported") {
    return {
      text: "",
      sourceType: "text",
      error: "Unsupported format. Use PDF, DOCX, Fountain, FDX, or plain text.",
    };
  }

  if (kind === "pdf") {
    const text = await extractPdfText(buffer);
    if (!text) {
      return {
        text: "",
        sourceType: "pdf",
        error: "Could not read text from this PDF. If it is a scan, try a text-based PDF export.",
      };
    }
    return { text, sourceType: "pdf" };
  }

  if (kind === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = truncateScriptText(result.value);
      if (!text) {
        return { text: "", sourceType: "docx", error: "No readable text found in this Word document." };
      }
      return { text, sourceType: "docx" };
    } catch (err) {
      console.error("DOCX script extraction failed:", err);
      return { text: "", sourceType: "docx", error: "Could not read this Word document." };
    }
  }

  const raw = buffer.toString("utf8");
  if (raw.trimStart().startsWith("%PDF-")) {
    const text = await extractPdfText(buffer);
    if (text) return { text, sourceType: "pdf" };
    return {
      text: "",
      sourceType: "pdf",
      error: "This file is a PDF — save it with a .pdf extension and import again.",
    };
  }

  const text = truncateScriptText(raw);
  if (!text) {
    return { text: "", sourceType: "text", error: "No readable text found in this file." };
  }
  return { text, sourceType: "text" };
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
