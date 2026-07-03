import "server-only";

import mammoth from "mammoth";
import { isAllowedStorageUrl } from "@/lib/storage-origin";
import { extractPdfTextFromBuffer } from "@/lib/ai-metadata/pdf-text-extract";
import {
  decodePlainTextBuffer,
  extractFdxText,
  extractOdtText,
  extractRtfText,
  truncateScriptText,
} from "@/lib/ai-metadata/screenplay-format-extract";

const MAX_SCRIPT_BYTES = 15 * 1024 * 1024;

export type ScriptFileExtraction = {
  text: string;
  sourceType: "pdf" | "docx" | "fdx" | "rtf" | "odt" | "text";
  extractionMethod?: string | null;
  error?: string;
};

type DetectedFormat = ScriptFileExtraction["sourceType"] | "unsupported";

function detectUploadType(filename: string, mimeType: string, buffer: Buffer): DetectedFormat {
  const lower = filename.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (mime.includes("pdf") || lower.endsWith(".pdf") || buffer.slice(0, 5).toString() === "%PDF-") {
    return "pdf";
  }
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  ) {
    return "docx";
  }
  if (mime.includes("opendocument.text") || lower.endsWith(".odt")) {
    return "odt";
  }
  if (mime.includes("rtf") || lower.endsWith(".rtf")) {
    return "rtf";
  }
  if (lower.endsWith(".fdx")) {
    return "fdx";
  }
  if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".fountain")) {
    return "text";
  }

  const sniff = decodePlainTextBuffer(buffer).trimStart();
  if (sniff.startsWith("%PDF-")) return "pdf";
  if (sniff.startsWith("{\\rtf")) return "rtf";
  if (sniff.startsWith("PK") || buffer.slice(0, 2).toString() === "PK") {
    if (lower.endsWith(".odt") || mime.includes("opendocument")) return "odt";
    if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx";
  }
  if (sniff.includes("<FinalDraft") || sniff.includes("<Paragraph")) return "fdx";

  return "unsupported";
}

function pdfImportError(byteLength: number): string {
  if (byteLength < 2_000) {
    return "This PDF is empty or too small to contain a screenplay. Try another file, or upload Fountain / FDX / DOCX.";
  }
  return "No readable text was found in this PDF. If it is a scan/image PDF, export as Fountain, FDX, or DOCX, or Print → Save as PDF with standard fonts.";
}

async function extractPdfScreenplay(buffer: Buffer): Promise<Pick<ScriptFileExtraction, "text" | "extractionMethod" | "error">> {
  const { text, method } = await extractPdfTextFromBuffer(buffer);
  if (!text) {
    return { text: "", extractionMethod: method, error: pdfImportError(buffer.byteLength) };
  }
  return { text: truncateScriptText(text), extractionMethod: method };
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
      error: "Unsupported format. Use PDF, DOCX, FDX, Fountain, RTF, ODT, or plain text.",
    };
  }

  if (kind === "pdf") {
    const pdf = await extractPdfScreenplay(buffer);
    if (pdf.error) {
      return { text: "", sourceType: "pdf", extractionMethod: pdf.extractionMethod, error: pdf.error };
    }
    return { text: pdf.text, sourceType: "pdf", extractionMethod: pdf.extractionMethod };
  }

  if (kind === "docx") {
    if (filename.toLowerCase().endsWith(".doc")) {
      return {
        text: "",
        sourceType: "docx",
        error: "Legacy .doc files are not supported. Save as .docx and import again.",
      };
    }
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = truncateScriptText(result.value);
      if (!text) {
        return { text: "", sourceType: "docx", error: "No readable text found in this Word document." };
      }
      return { text, sourceType: "docx", extractionMethod: "mammoth" };
    } catch (err) {
      console.error("DOCX script extraction failed:", err);
      return { text: "", sourceType: "docx", error: "Could not read this Word document." };
    }
  }

  if (kind === "fdx") {
    const text = extractFdxText(decodePlainTextBuffer(buffer));
    if (!text) {
      return { text: "", sourceType: "fdx", error: "No readable screenplay content found in this FDX file." };
    }
    return { text, sourceType: "fdx", extractionMethod: "fdx-xml" };
  }

  if (kind === "rtf") {
    const text = extractRtfText(decodePlainTextBuffer(buffer));
    if (!text) {
      return { text: "", sourceType: "rtf", error: "No readable text found in this RTF file." };
    }
    return { text, sourceType: "rtf", extractionMethod: "rtf-strip" };
  }

  if (kind === "odt") {
    try {
      const text = await extractOdtText(buffer);
      if (!text) {
        return { text: "", sourceType: "odt", error: "No readable text found in this ODT file." };
      }
      return { text, sourceType: "odt", extractionMethod: "odt-xml" };
    } catch (err) {
      console.error("ODT script extraction failed:", err);
      return { text: "", sourceType: "odt", error: "Could not read this OpenDocument file." };
    }
  }

  const raw = decodePlainTextBuffer(buffer);
  if (raw.trimStart().startsWith("%PDF-")) {
    const pdf = await extractPdfScreenplay(buffer);
    if (pdf.text) {
      return { text: pdf.text, sourceType: "pdf", extractionMethod: pdf.extractionMethod };
    }
    return { text: "", sourceType: "pdf", extractionMethod: pdf.extractionMethod, error: pdf.error };
  }
  if (raw.trimStart().startsWith("{\\rtf")) {
    const text = extractRtfText(raw);
    if (text) return { text, sourceType: "rtf", extractionMethod: "rtf-strip" };
  }
  if (raw.includes("<FinalDraft") || raw.includes("<Paragraph")) {
    const text = extractFdxText(raw);
    if (text) return { text, sourceType: "fdx", extractionMethod: "fdx-xml" };
  }

  const text = truncateScriptText(raw);
  if (!text) {
    return { text: "", sourceType: "text", error: "No readable text found in this file." };
  }
  return { text, sourceType: "text", extractionMethod: "plain-text" };
}

/** Fetch an uploaded script document and return screenplay text. */
export async function fetchScriptTextFromUrl(url: string): Promise<string | null> {
  if (!isAllowedStorageUrl(url)) return null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_SCRIPT_BYTES) return null;

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const filename = url.split("/").pop()?.split("?")[0] ?? "script";
    const result = await extractScreenplayFromFileBuffer(buf, filename, contentType);
    return result.text || null;
  } catch (err) {
    console.error("Script fetch failed:", err);
    return null;
  }
}
