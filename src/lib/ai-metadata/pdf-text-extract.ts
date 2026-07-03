import "server-only";

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

function hasMeaningfulText(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 16;
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

function textContentToScreenplayText(items: PdfTextItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (!item.str) continue;
    parts.push(item.str);
    if (item.hasEOL) parts.push("\n");
  }
  const joined = parts.join("");
  if (hasMeaningfulText(joined)) return normalizePdfLines(joined);

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

  return normalizePdfLines(lines.join("\n"));
}

async function extractWithPdfParse(buffer: Buffer, disableNormalization = false): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({
      lineEnforce: true,
      lineThreshold: 3.5,
      pageJoiner: "\n",
      disableNormalization,
    });
    return normalizePdfLines(result.text ?? "");
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

/** Extract readable text from a PDF buffer using multiple strategies. */
export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string | null> {
  const strategies = [
    () => extractWithPdfParse(buffer, false),
    () => extractWithPdfParse(buffer, true),
    () => extractWithPdfJs(buffer),
  ];

  let best = "";
  for (const strategy of strategies) {
    try {
      const text = await strategy();
      if (!text) continue;
      if (!hasMeaningfulText(text)) {
        if (text.length > best.length) best = text;
        continue;
      }
      return text;
    } catch (err) {
      console.warn("PDF extraction strategy failed:", err);
    }
  }

  return hasMeaningfulText(best) ? best : null;
}
