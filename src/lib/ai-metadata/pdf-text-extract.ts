import "server-only";

import { createRequire } from "node:module";
import { extractPdfTextFromContentStreams } from "@/lib/ai-metadata/pdf-stream-text-extract";

const require = createRequire(import.meta.url);

export type PdfExtractionResult = {
  text: string | null;
  method: string | null;
};

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

function hasMeaningfulText(text: string, minLetters = 8): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= minLetters;
}

function normalizePdfLines(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/\f/g, "\n")
    .trim();
}

function reflowDenseScreenplayText(text: string): string {
  if (text.split("\n").length >= 4) return text;
  return text
    .replace(/\s+(?=(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s)/gi, "\n\n")
    .replace(/([.!?])\s+(?=[A-Z][a-z])/g, "$1\n")
    .trim();
}

function textContentToScreenplayText(items: PdfTextItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (!item.str) continue;
    parts.push(item.str);
    if (item.hasEOL) parts.push("\n");
  }
  const joined = parts.join("");
  if (hasMeaningfulText(joined)) return normalizePdfLines(reflowDenseScreenplayText(joined));

  const rows = new Map<number, { x: number; str: string }[]>();
  for (const item of items) {
    if (!item.str || !item.transform?.length) continue;
    const y = Math.round(item.transform[5] ?? 0);
    const x = item.transform[4] ?? 0;
    const row = rows.get(y) ?? [];
    row.push({ x, str: item.str });
    rows.set(y, row);
  }

  const lines = [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, rowItems]) => rowItems.sort((a, b) => a.x - b.x).map((part) => part.str).join(""));

  return normalizePdfLines(reflowDenseScreenplayText(lines.join("\n")));
}

let pdfParseWorkerReady = false;

async function ensurePdfParseWorker(): Promise<void> {
  if (pdfParseWorkerReady) return;
  try {
    const { PDFParse } = await import("pdf-parse");
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    PDFParse.setWorker(workerPath);
    pdfParseWorkerReady = true;
  } catch (err) {
    console.warn("Could not configure pdf-parse worker:", err);
  }
}

async function extractWithPdfParse(buffer: Buffer, disableNormalization = false): Promise<string> {
  await ensurePdfParseWorker();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({
      lineEnforce: true,
      lineThreshold: 2.8,
      pageJoiner: "\n",
      disableNormalization,
    });
    return normalizePdfLines(reflowDenseScreenplayText(result.text ?? ""));
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: false,
    verbosity: 0,
  }).promise;

  try {
    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = textContentToScreenplayText(content.items as PdfTextItem[]);
      if (pageText) pageTexts.push(pageText);
    }
    return normalizePdfLines(pageTexts.join("\n\n"));
  } finally {
    await doc.destroy().catch(() => {});
  }
}

function extractWithPdfStreams(buffer: Buffer): string {
  return normalizePdfLines(reflowDenseScreenplayText(extractPdfTextFromContentStreams(buffer)));
}

function extractWithPdfAsciiSniff(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const sluglines = raw.match(/(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)[^\x00-\x08\x0b\x0c\x0e-\x1f]{3,140}/gi) ?? [];
  const cues = raw.match(/\b[A-Z][A-Z0-9 '().\-]{2,36}\b/g) ?? [];
  const prose = raw.match(/[A-Za-z][A-Za-z0-9 ,.'"()\-:;!?]{20,180}/g) ?? [];
  const merged = [...sluglines, ...cues, ...prose]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => /[A-Za-z]{3,}/.test(part));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of merged) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return normalizePdfLines(reflowDenseScreenplayText(unique.join("\n")));
}

/** Extract readable text from a PDF buffer using multiple strategies. */
export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  const strategies: Array<{ method: string; run: () => Promise<string> | string }> = [
    { method: "pdf-parse", run: () => extractWithPdfParse(buffer, false) },
    { method: "pdf-parse-raw", run: () => extractWithPdfParse(buffer, true) },
    { method: "pdfjs", run: () => extractWithPdfJs(buffer) },
    { method: "pdf-stream", run: () => extractWithPdfStreams(buffer) },
    { method: "pdf-ascii-sniff", run: () => extractWithPdfAsciiSniff(buffer) },
  ];

  let best = "";
  let bestMethod: string | null = null;

  for (const strategy of strategies) {
    try {
      const text = await strategy.run();
      if (!text) continue;
      if (hasMeaningfulText(text)) {
        return { text, method: strategy.method };
      }
      if (text.length > best.length) {
        best = text;
        bestMethod = strategy.method;
      }
    } catch (err) {
      console.warn(`PDF extraction (${strategy.method}) failed:`, err);
    }
  }

  if (hasMeaningfulText(best, 4)) {
    return { text: best, method: bestMethod };
  }

  return { text: null, method: null };
}
