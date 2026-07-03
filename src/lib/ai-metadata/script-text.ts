import "server-only";

import mammoth from "mammoth";
import { extractPdfTextFromBuffer } from "@/lib/ai-metadata/pdf-text-extract";
import {
  decodePlainTextBuffer,
  extractFdxText,
  extractOdtText,
  extractRtfText,
} from "@/lib/ai-metadata/screenplay-format-extract";

const MAX_SCRIPT_BYTES = 12 * 1024 * 1024;
const MAX_SCRIPT_CHARS = 80_000;
const FETCH_TIMEOUT_MS = 15_000;

export type ScriptTextExtraction = {
  text: string;
  sourceType: "pdf" | "docx" | "text" | "unsupported";
  truncated: boolean;
  error?: string;
};

function extensionFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
  } catch {
    return url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  }
}

function detectScriptType(contentType: string, url: string): ScriptTextExtraction["sourceType"] {
  const type = contentType.toLowerCase();
  const ext = extensionFromUrl(url);
  if (type.includes("pdf") || ext === "pdf") return "pdf";
  if (
    type.includes("wordprocessingml") ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (type.includes("rtf") || ext === "rtf") return "text";
  if (type.includes("opendocument.text") || ext === "odt") return "text";
  if (type.startsWith("text/") || ["txt", "fountain", "fdx"].includes(ext)) return "text";
  return "unsupported";
}

function normalizeExtractedText(text: string): { text: string; truncated: boolean } {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (normalized.length <= MAX_SCRIPT_CHARS) return { text: normalized, truncated: false };
  return { text: normalized.slice(0, MAX_SCRIPT_CHARS), truncated: true };
}

async function fetchScriptBuffer(scriptUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(scriptUrl, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`Script fetch failed (${res.status})`);
    const length = Number(res.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > MAX_SCRIPT_BYTES) {
      throw new Error("Script file is too large for automatic analysis");
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SCRIPT_BYTES) {
      throw new Error("Script file is too large for automatic analysis");
    }
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractScriptTextFromUrl(
  scriptUrl: string | null | undefined,
): Promise<ScriptTextExtraction | null> {
  const url = scriptUrl?.trim();
  if (!url) return null;

  try {
    const { buffer, contentType } = await fetchScriptBuffer(url);
    const sourceType = detectScriptType(contentType, url);
    if (sourceType === "unsupported") {
      return {
        text: "",
        sourceType,
        truncated: false,
        error: "Unsupported script file type for automatic text extraction",
      };
    }

    if (sourceType === "text") {
      const ext = extensionFromUrl(url);
      const decoded = decodePlainTextBuffer(buffer);
      if (ext === "fdx" || decoded.includes("<FinalDraft")) {
        return { sourceType, ...normalizeExtractedText(extractFdxText(decoded)) };
      }
      if (ext === "rtf" || decoded.trimStart().startsWith("{\\rtf")) {
        return { sourceType, ...normalizeExtractedText(extractRtfText(decoded)) };
      }
      if (ext === "odt") {
        return { sourceType, ...normalizeExtractedText(await extractOdtText(buffer)) };
      }
      return { sourceType, ...normalizeExtractedText(decoded) };
    }

    if (sourceType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      return { sourceType, ...normalizeExtractedText(result.value) };
    }

    const pdfText = await extractPdfTextFromBuffer(buffer);
    if (!pdfText) {
      return {
        text: "",
        sourceType: "pdf",
        truncated: false,
        error: "Could not extract readable text from PDF",
      };
    }
    return { sourceType, ...normalizeExtractedText(pdfText) };
  } catch (err) {
    return {
      text: "",
      sourceType: detectScriptType("", url),
      truncated: false,
      error: err instanceof Error ? err.message : "Script text extraction failed",
    };
  }
}
