/**
 * Shared multi-page PDF 1.4 builder for production documents (call sheets, reports).
 * No external deps — emits a real PDF download, not a screen capture.
 */

export type PdfBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "line"; text: string }
  | { type: "blank" }
  | { type: "kv"; label: string; value: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "bullets"; items: string[] };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(text: string, maxChars: number): string[] {
  const clean = (text ?? "").replace(/\r\n/g, "\n").replace(/\t/g, " ");
  if (!clean) return [""];
  const out: string[] = [];
  for (const paragraph of clean.split("\n")) {
    if (paragraph.length <= maxChars) {
      out.push(paragraph);
      continue;
    }
    let rest = paragraph;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(" ", maxChars);
      const idx = cut > Math.floor(maxChars * 0.45) ? cut : maxChars;
      out.push(rest.slice(0, idx).trimEnd());
      rest = rest.slice(idx).trimStart();
    }
    if (rest) out.push(rest);
  }
  return out.length ? out : [""];
}

function charsForFontSize(fontSize: number): number {
  // Approximate Helvetica average glyph width.
  return Math.max(24, Math.floor(CONTENT_WIDTH / (fontSize * 0.5)));
}

type DrawnLine = { text: string; fontSize: number; bold?: boolean; indent?: number };

function blockToLines(block: PdfBlock): DrawnLine[] {
  switch (block.type) {
    case "title":
      return wrapLine(block.text, charsForFontSize(16)).map((text) => ({ text, fontSize: 16, bold: true }));
    case "subtitle":
      return wrapLine(block.text, charsForFontSize(11)).map((text) => ({ text, fontSize: 11 }));
    case "heading":
      return [
        { text: "", fontSize: 8 },
        ...wrapLine(block.text.toUpperCase(), charsForFontSize(11)).map((text) => ({
          text,
          fontSize: 11,
          bold: true,
        })),
        { text: "", fontSize: 4 },
      ];
    case "line":
      return wrapLine(block.text, charsForFontSize(10)).map((text) => ({ text, fontSize: 10 }));
    case "blank":
      return [{ text: "", fontSize: 8 }];
    case "kv": {
      const label = `${block.label}: `;
      const wrapped = wrapLine(`${label}${block.value}`, charsForFontSize(10));
      return wrapped.map((text, i) => ({
        text: i === 0 ? text : `   ${text}`,
        fontSize: 10,
      }));
    }
    case "bullets":
      return block.items.flatMap((item) =>
        wrapLine(`• ${item}`, charsForFontSize(10)).map((text, i) => ({
          text: i === 0 ? text : `  ${text}`,
          fontSize: 10,
        })),
      );
    case "table": {
      const colCount = Math.max(1, block.headers.length);
      const colWidth = Math.floor(charsForFontSize(9) / colCount);
      const pad = (cells: string[]) =>
        cells
          .slice(0, colCount)
          .map((c) => {
            const t = (c ?? "").replace(/\s+/g, " ").trim();
            return t.length > colWidth ? `${t.slice(0, Math.max(1, colWidth - 1))}…` : t.padEnd(colWidth);
          })
          .join(" ");
      const lines: DrawnLine[] = [
        { text: pad(block.headers), fontSize: 9, bold: true },
        { text: "-".repeat(Math.min(charsForFontSize(9), colWidth * colCount + colCount)), fontSize: 8 },
      ];
      for (const row of block.rows) {
        lines.push({ text: pad(row), fontSize: 9 });
      }
      lines.push({ text: "", fontSize: 6 });
      return lines;
    }
    default:
      return [];
  }
}

function buildPageContent(lines: DrawnLine[], pageIndex: number, pageCount: number, footer: string): string {
  const parts: string[] = ["BT", "/F1 10 Tf"];
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let currentSize = 10;
  let first = true;

  for (const line of lines) {
    const size = line.fontSize;
    const leading = size + 3;
    if (size !== currentSize) {
      parts.push(`/F1 ${size} Tf`);
      currentSize = size;
    }
    const x = MARGIN_X + (line.indent ?? 0);
    if (first) {
      parts.push(`1 0 0 1 ${x} ${y} Tm`);
      first = false;
    } else {
      parts.push(`1 0 0 1 ${x} ${y} Tm`);
    }
    parts.push(`(${escapePdfText(line.text || " ")}) Tj`);
    y -= leading;
  }

  // Footer
  parts.push("/F1 8 Tf");
  parts.push(`1 0 0 1 ${MARGIN_X} ${MARGIN_BOTTOM - 18} Tm`);
  const footerText = `${footer} · Page ${pageIndex + 1} of ${pageCount}`;
  parts.push(`(${escapePdfText(footerText)}) Tj`);
  parts.push("ET");
  return parts.join("\n");
}

/** Build a multi-page PDF from structured document blocks. */
export function buildDocumentPdf(options: {
  title: string;
  footer?: string;
  blocks: PdfBlock[];
}): Buffer {
  const drawn = options.blocks.flatMap(blockToLines);
  const pages: DrawnLine[][] = [];
  let current: DrawnLine[] = [];
  let y = PAGE_HEIGHT - MARGIN_TOP;

  for (const line of drawn) {
    const leading = line.fontSize + 3;
    if (y - leading < MARGIN_BOTTOM && current.length > 0) {
      pages.push(current);
      current = [];
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
    current.push(line);
    y -= leading;
  }
  if (current.length > 0 || pages.length === 0) pages.push(current);

  const footer = options.footer ?? options.title;
  const pageStreams = pages.map((pageLines, i) =>
    buildPageContent(pageLines, i, pages.length, footer),
  );

  const objects: string[] = [];
  // 1 catalog, 2 pages, then per page: page obj + content, then font
  const pageCount = pageStreams.length;
  const fontObjNum = 3 + pageCount * 2;

  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");

  const kids = pageStreams.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push(`2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageCount} >> endobj\n`);

  for (let i = 0; i < pageStreams.length; i += 1) {
    const pageObj = 3 + i * 2;
    const contentObj = pageObj + 1;
    const stream = pageStreams[i]!;
    objects.push(
      `${pageObj} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >> endobj\n`,
    );
    objects.push(
      `${contentObj} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj\n`,
    );
  }

  objects.push(
    `${fontObjNum} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`,
  );

  let pdf = "%PDF-1.4\n";
  const xref: number[] = [0];
  for (const obj of objects) {
    xref.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${xref.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < xref.length; i += 1) {
    pdf += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function pdfAttachmentResponse(pdf: Buffer, filename: string): Response {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}
