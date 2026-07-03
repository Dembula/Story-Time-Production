import "server-only";

import { createRequire } from "node:module";
import { extractPdfTextFromContentStreams } from "@/lib/ai-metadata/pdf-stream-text-extract";
import {
  lightCleanScreenplayText,
  normalizeImportedScreenplayLayout,
  scoreScreenplayLayout,
} from "@/lib/script-studio/screenplay-layout-repair";

const require = createRequire(import.meta.url);

export type PdfExtractionResult = {
  text: string | null;
  method: string | null;
};

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  width?: number;
  height?: number;
  transform?: number[];
};

function hasMeaningfulText(text: string, minLetters = 8): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= minLetters;
}

/**
 * Reconstruct screenplay lines from pdf.js text items using positions.
 * Spaces come from horizontal gaps between items; blank lines from vertical gaps.
 */
function textItemsToScreenplayLines(items: PdfTextItem[]): string {
  type Placed = { x: number; y: number; endX: number; height: number; str: string };

  const placed: Placed[] = [];
  for (const item of items) {
    const str = item.str ?? "";
    if (!str || !item.transform || item.transform.length < 6) continue;

    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const height = Math.abs(item.height || item.transform[3] || 12) || 12;
    const width =
      typeof item.width === "number" && item.width > 0
        ? item.width
        : Math.max(str.replace(/\s+$/g, "").length, 1) * height * 0.5;

    placed.push({ x, y, endX: x + width, height, str });
  }

  if (placed.length === 0) return "";

  const avgHeight =
    placed.reduce((sum, item) => sum + item.height, 0) / Math.max(placed.length, 1);
  const yTolerance = Math.max(avgHeight * 0.35, 2);

  const rows: Array<{ y: number; items: Placed[] }> = [];
  for (const item of placed) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= yTolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  rows.sort((a, b) => b.y - a.y);

  const lines: string[] = [];
  let previousY: number | null = null;

  for (const row of rows) {
    const sorted = [...row.items].sort((a, b) => a.x - b.x);
    let line = "";

    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i]!;
      const next = sorted[i + 1];
      line += item.str;

      if (!next) continue;
      if (/\s$/.test(item.str) || /^\s/.test(next.str)) continue;

      const gap = next.x - item.endX;
      // Screenplay PDFs (Courier) often advance only slightly past glyph width.
      // Use a low positive threshold so words separate without splitting letters.
      const spaceThreshold = Math.max(item.height * 0.04, 0.35);
      if (gap > spaceThreshold) line += " ";
    }

    const cleaned = line.replace(/[ \t]{2,}/g, " ").trim();
    if (!cleaned) continue;

    if (previousY !== null) {
      const verticalGap = previousY - row.y;
      // Larger than a normal line advance => paragraph / element break
      if (verticalGap > avgHeight * 1.55) lines.push("");
    }

    lines.push(cleaned);
    previousY = row.y;
  }

  return lines.join("\n");
}

function finalizePdfText(raw: string): string {
  // Prefer preserving a good extraction; only repair when clearly broken.
  const cleaned = lightCleanScreenplayText(raw);
  const score = scoreScreenplayLayout(cleaned);
  if (score >= 40) return cleaned;
  return normalizeImportedScreenplayLayout(cleaned).text;
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
      pageJoiner: "\n\n",
      disableNormalization,
    });
    return finalizePdfText(result.text ?? "");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: false,
      verbosity: 0,
    })
    .promise;

  try {
    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false,
      });
      const pageText = textItemsToScreenplayLines(content.items as PdfTextItem[]);
      if (pageText.trim()) pageTexts.push(pageText.trim());
    }
    return finalizePdfText(pageTexts.join("\n\n"));
  } finally {
    await doc.destroy().catch(() => {});
  }
}

function extractWithPdfStreams(buffer: Buffer): string {
  return finalizePdfText(extractPdfTextFromContentStreams(buffer));
}

/** Extract readable screenplay text from a PDF buffer. */
export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  const strategies: Array<{ method: string; run: () => Promise<string> | string }> = [
    { method: "pdfjs", run: () => extractWithPdfJs(buffer) },
    { method: "pdf-parse", run: () => extractWithPdfParse(buffer, false) },
    { method: "pdf-parse-raw", run: () => extractWithPdfParse(buffer, true) },
    { method: "pdf-stream", run: () => extractWithPdfStreams(buffer) },
  ];

  let bestText = "";
  let bestMethod: string | null = null;
  let bestScore = -Infinity;

  for (const strategy of strategies) {
    try {
      const text = await strategy.run();
      if (!text || !hasMeaningfulText(text)) continue;
      const score = scoreScreenplayLayout(text);
      if (score < 10 && bestScore >= 10) continue;
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
        bestMethod = strategy.method;
      }
    } catch (err) {
      console.warn(`PDF extraction (${strategy.method}) failed:`, err);
    }
  }

  if (bestText && bestScore >= 5) {
    return { text: bestText, method: bestMethod };
  }

  return { text: null, method: null };
}
