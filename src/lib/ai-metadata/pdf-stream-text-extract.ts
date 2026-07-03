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
    const block = match[1] ?? "";
    const innerLiteral = /\(((?:\\.|[^\\)])*)\)/g;
    let innerMatch = innerLiteral.exec(block);
    while (innerMatch) {
      const decoded = decodePdfLiteral(innerMatch[1] ?? "").trim();
      if (decoded) strings.push(decoded);
      innerMatch = innerLiteral.exec(block);
    }
    const innerHex = /<([0-9A-Fa-f\s]+)>/g;
    let hexMatch = innerHex.exec(block);
    while (hexMatch) {
      const decoded = decodePdfHex(hexMatch[1] ?? "").trim();
      if (decoded) strings.push(decoded);
      hexMatch = innerHex.exec(block);
    }
    match = tjArray.exec(content);
  }

  return strings;
}

function reflowScreenplayChunks(chunks: string[]): string {
  const lines: string[] = [];
  for (const chunk of chunks) {
    const pieces = chunk
      .split(/\s+(?=(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s)/i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (pieces.length > 1) {
      lines.push(...pieces);
      continue;
    }
  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(chunk.trim())) {
      lines.push(chunk.trim());
    } else if (/^[A-Z0-9 '().\-]{2,}$/.test(chunk.trim()) && chunk.trim().length < 40) {
      lines.push(chunk.trim());
    } else {
      lines.push(chunk.trim());
    }
  }
  return lines.join("\n");
}

/**
 * Fallback for TeX / custom-font PDFs where pdf-parse and pdfjs return empty text.
 * Reads literal strings from PDF content streams (common in pdfTeX screenplays).
 */
export function extractPdfTextFromContentStreams(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const streamRe = /([\s\S]{0,240}\bstream\b[\s\r\n]*)([\s\S]*?)\r?\nendstream/g;
  const allStrings: string[] = [];

  let match = streamRe.exec(latin1);
  while (match) {
    const header = match[1] ?? "";
    const body = match[2] ?? "";
    const content = inflateStreamIfNeeded(body, header);
    allStrings.push(...extractStringsFromOperators(content));
    match = streamRe.exec(latin1);
  }

  if (allStrings.length === 0) {
    const globalLiteral = /\(((?:\\.|[^\\)])*)\)/g;
    let literal = globalLiteral.exec(latin1);
    while (literal) {
      const decoded = decodePdfLiteral(literal[1] ?? "").trim();
      if (decoded.length >= 2 && /[A-Za-z]/.test(decoded)) {
        allStrings.push(decoded);
      }
      literal = globalLiteral.exec(latin1);
    }
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of allStrings) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return reflowScreenplayChunks(unique)
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
