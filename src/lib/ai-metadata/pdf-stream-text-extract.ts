import "server-only";

import zlib from "node:zlib";

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(parseInt(octal, 8) & 0xff),
    );
}

function decodePdfHex(hex: string): string {
  const cleaned = hex.replace(/\s+/g, "");
  if (!cleaned) return "";
  const padded = cleaned.length % 2 === 1 ? `${cleaned}0` : cleaned;
  const bytes: string[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    bytes.push(String.fromCharCode(parseInt(padded.slice(i, i + 2), 16)));
  }
  return bytes.join("");
}

function inflateStreamIfNeeded(streamBody: string, header: string): string {
  if (!/\/FlateDecode\b/.test(header)) return streamBody;
  try {
    return zlib.inflateSync(Buffer.from(streamBody, "latin1")).toString("latin1");
  } catch {
    return streamBody;
  }
}

type PlacedText = { x: number; y: number; text: string };

function decodeTjOperand(operand: string): string {
  const trimmed = operand.trim();
  if (trimmed.startsWith("(")) {
    return decodePdfLiteral(trimmed.replace(/\)\s*Tj\s*$/i, "").slice(1));
  }
  if (trimmed.startsWith("<")) {
    return decodePdfHex(trimmed.replace(/>\s*Tj\s*$/i, "").slice(1));
  }
  return "";
}

function decodeTJArray(block: string): string {
  const parts: string[] = [];
  const literalRe = /\(((?:\\.|[^\\)])*)\)/g;
  let m = literalRe.exec(block);
  while (m) {
    const decoded = decodePdfLiteral(m[1] ?? "").trim();
    if (decoded) parts.push(decoded);
    m = literalRe.exec(block);
  }
  const hexRe = /<([0-9A-Fa-f\s]+)>/g;
  let hx = hexRe.exec(block);
  while (hx) {
    const decoded = decodePdfHex(hx[1] ?? "").trim();
    if (decoded) parts.push(decoded);
    hx = hexRe.exec(block);
  }
  return parts.join("");
}

function parsePositionedText(content: string): PlacedText[] {
  const placed: PlacedText[] = [];
  const blocks = content.split(/\bBT\b/);

  for (const block of blocks.slice(1)) {
    const segment = (block.split(/\bET\b/)[0] ?? block).trim();
    if (!segment) continue;

    let x = 0;
    let y = 0;

    const opRe =
      /(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+Tm|(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+Td|\(((?:\\.|[^\\)])*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ/g;

    let match = opRe.exec(segment);
    while (match) {
      if (match[6] !== undefined) {
        x = parseFloat(match[5]!);
        y = parseFloat(match[6]!);
      } else if (match[8] !== undefined) {
        x += parseFloat(match[7]!);
        y += parseFloat(match[8]!);
      } else if (match[9] !== undefined) {
        const text = decodePdfLiteral(match[9]).trim();
        if (text) placed.push({ x, y, text });
      } else if (match[10] !== undefined) {
        const text = decodePdfHex(match[10]).trim();
        if (text) placed.push({ x, y, text });
      } else if (match[11] !== undefined) {
        const text = decodeTJArray(match[11]).trim();
        if (text) placed.push({ x, y, text });
      }
      match = opRe.exec(segment);
    }
  }

  return placed;
}

function groupPlacedTextToLines(placed: PlacedText[]): string[] {
  if (placed.length === 0) return [];

  const yTolerance = 3;
  const rows: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];

  for (const item of placed) {
    const existing = rows.find((row) => Math.abs(row.y - item.y) <= yTolerance);
    if (existing) {
      existing.parts.push({ x: item.x, text: item.text });
    } else {
      rows.push({ y: item.y, parts: [{ x: item.x, text: item.text }] });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function extractStringsFromOperators(content: string): string[] {
  const strings: string[] = [];

  const literalTj = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match = literalTj.exec(content);
  while (match) {
    const decoded = decodePdfLiteral(match[1] ?? "").trim();
    if (decoded) strings.push(decoded);
    match = literalTj.exec(content);
  }

  const hexTj = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
  match = hexTj.exec(content);
  while (match) {
    const decoded = decodePdfHex(match[1] ?? "").trim();
    if (decoded) strings.push(decoded);
    match = hexTj.exec(content);
  }

  const tjArray = /\[([\s\S]*?)\]\s*TJ/g;
  match = tjArray.exec(content);
  while (match) {
    const decoded = decodeTJArray(match[1] ?? "").trim();
    if (decoded) strings.push(decoded);
    match = tjArray.exec(content);
  }

  return strings;
}

function joinSequentialChunks(chunks: string[]): string {
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fallback for TeX / custom-font PDFs where pdf-parse and pdfjs return empty text.
 * Uses positioned text operators when available; otherwise joins sequential tokens.
 */
export function extractPdfTextFromContentStreams(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const streamRe = /([\s\S]{0,240}\bstream\b[\s\r\n]*)([\s\S]*?)\r?\nendstream/g;
  const positioned: PlacedText[] = [];
  const sequential: string[] = [];

  let match = streamRe.exec(latin1);
  while (match) {
    const header = match[1] ?? "";
    const body = match[2] ?? "";
    const content = inflateStreamIfNeeded(body, header);
    positioned.push(...parsePositionedText(content));
    sequential.push(...extractStringsFromOperators(content));
    match = streamRe.exec(latin1);
  }

  if (positioned.length > 0) {
    return groupPlacedTextToLines(positioned).join("\n\n").trim();
  }

  if (sequential.length > 0) {
    return joinSequentialChunks(sequential);
  }

  const globalLiteral = /\(((?:\\.|[^\\)])*)\)/g;
  let literal = globalLiteral.exec(latin1);
  const fallback: string[] = [];
  while (literal) {
    const decoded = decodePdfLiteral(literal[1] ?? "").trim();
    if (decoded.length >= 1 && /[A-Za-z0-9]/.test(decoded)) {
      fallback.push(decoded);
    }
    literal = globalLiteral.exec(latin1);
  }

  return joinSequentialChunks(fallback);
}
