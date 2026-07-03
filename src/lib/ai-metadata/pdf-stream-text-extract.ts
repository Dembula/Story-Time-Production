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

type PlacedText = { x: number; y: number; text: string; widthHint: number };

function decodeTJArray(block: string): string {
  // TJ arrays interleave strings and kerning numbers. Negative kerning is common
  // between letters of the same word; large negative/positive gaps imply a space.
  const tokens: Array<{ kind: "text" | "gap"; value: string | number }> = [];
  const tokenRe = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>|(-?\d*\.?\d+)/g;
  let m = tokenRe.exec(block);
  while (m) {
    if (m[1] !== undefined) {
      tokens.push({ kind: "text", value: decodePdfLiteral(m[1]) });
    } else if (m[2] !== undefined) {
      tokens.push({ kind: "text", value: decodePdfHex(m[2]) });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: "gap", value: parseFloat(m[3]) });
    }
    m = tokenRe.exec(block);
  }

  let out = "";
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.kind === "text") {
      out += String(token.value);
      continue;
    }
    const gap = Number(token.value);
    // In PDF text space, large negative numbers pull glyphs closer; values around
    // -200..-400 often represent a word space in TeX/Courier screenplays.
    if (gap <= -180) out += " ";
  }
  return out;
}

function parsePositionedText(content: string): PlacedText[] {
  const placed: PlacedText[] = [];
  const blocks = content.split(/\bBT\b/);

  for (const block of blocks.slice(1)) {
    const segment = (block.split(/\bET\b/)[0] ?? block).trim();
    if (!segment) continue;

    let x = 0;
    let y = 0;
    let fontSize = 12;

    const opRe =
      /(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+Tm|(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+Td|(-?\d*\.?\d+)\s+TL|\/[A-Za-z0-9]+\s+(-?\d*\.?\d+)\s+Tf|\(((?:\\.|[^\\)])*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ/g;

    let match = opRe.exec(segment);
    while (match) {
      if (match[6] !== undefined) {
        fontSize = Math.abs(parseFloat(match[4] || "12")) || fontSize;
        x = parseFloat(match[5]!);
        y = parseFloat(match[6]!);
      } else if (match[8] !== undefined) {
        x += parseFloat(match[7]!);
        y += parseFloat(match[8]!);
      } else if (match[9] !== undefined) {
        // TL — ignore leading for now
      } else if (match[10] !== undefined) {
        fontSize = Math.abs(parseFloat(match[10])) || fontSize;
      } else if (match[11] !== undefined) {
        const text = decodePdfLiteral(match[11]);
        if (text) {
          placed.push({
            x,
            y,
            text,
            widthHint: Math.max(text.length * fontSize * 0.5, fontSize * 0.35),
          });
          x += text.length * fontSize * 0.5;
        }
      } else if (match[12] !== undefined) {
        const text = decodePdfHex(match[12]);
        if (text) {
          placed.push({
            x,
            y,
            text,
            widthHint: Math.max(text.length * fontSize * 0.5, fontSize * 0.35),
          });
          x += text.length * fontSize * 0.5;
        }
      } else if (match[13] !== undefined) {
        const text = decodeTJArray(match[13]);
        if (text) {
          placed.push({
            x,
            y,
            text,
            widthHint: Math.max(text.length * fontSize * 0.5, fontSize * 0.35),
          });
          x += text.length * fontSize * 0.5;
        }
      }
      match = opRe.exec(segment);
    }
  }

  return placed;
}

function groupPlacedTextToLines(placed: PlacedText[]): string[] {
  if (placed.length === 0) return [];

  const avgWidth =
    placed.reduce((sum, item) => sum + item.widthHint / Math.max(item.text.length, 1), 0) /
    Math.max(placed.length, 1);
  const yTolerance = Math.max(avgWidth * 0.8, 2.5);

  const rows: Array<{ y: number; parts: PlacedText[] }> = [];
  for (const item of placed) {
    const existing = rows.find((row) => Math.abs(row.y - item.y) <= yTolerance);
    if (existing) existing.parts.push(item);
    else rows.push({ y: item.y, parts: [item] });
  }

  const sortedRows = rows.sort((a, b) => b.y - a.y);
  const lines: string[] = [];
  let previousY: number | null = null;

  for (const row of sortedRows) {
    const parts = [...row.parts].sort((a, b) => a.x - b.x);
    let line = "";
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const next = parts[i + 1];
      line += part.text;
      if (!next) continue;
      const gap = next.x - (part.x + part.widthHint);
      const spaceThreshold = Math.max(avgWidth * 0.08, 0.35);
      if (gap > spaceThreshold && !/\s$/.test(part.text) && !/^\s/.test(next.text)) {
        line += " ";
      }
    }
    const cleaned = line.replace(/[ \t]{2,}/g, " ").trim();
    if (!cleaned) continue;

    if (previousY !== null && previousY - row.y > avgWidth * 2.2) {
      lines.push("");
    }
    lines.push(cleaned);
    previousY = row.y;
  }

  return lines;
}

function extractStringsFromOperators(content: string): string[] {
  const strings: string[] = [];

  const literalTj = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match = literalTj.exec(content);
  while (match) {
    const decoded = decodePdfLiteral(match[1] ?? "");
    if (decoded.trim()) strings.push(decoded);
    match = literalTj.exec(content);
  }

  const hexTj = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
  match = hexTj.exec(content);
  while (match) {
    const decoded = decodePdfHex(match[1] ?? "");
    if (decoded.trim()) strings.push(decoded);
    match = hexTj.exec(content);
  }

  const tjArray = /\[([\s\S]*?)\]\s*TJ/g;
  match = tjArray.exec(content);
  while (match) {
    const decoded = decodeTJArray(match[1] ?? "");
    if (decoded.trim()) strings.push(decoded);
    match = tjArray.exec(content);
  }

  return strings;
}

function joinSequentialChunks(chunks: string[]): string {
  // Prefer preserving embedded spaces; only insert a space between bare tokens.
  let out = "";
  for (const chunk of chunks) {
    if (!chunk) continue;
    if (!out) {
      out = chunk;
      continue;
    }
    if (/\s$/.test(out) || /^\s/.test(chunk)) out += chunk;
    else out += ` ${chunk}`;
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
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
    return groupPlacedTextToLines(positioned).join("\n").trim();
  }

  if (sequential.length > 0) {
    return joinSequentialChunks(sequential);
  }

  const globalLiteral = /\(((?:\\.|[^\\)])*)\)/g;
  let literal = globalLiteral.exec(latin1);
  const fallback: string[] = [];
  while (literal) {
    const decoded = decodePdfLiteral(literal[1] ?? "");
    if (decoded.length >= 1 && /[A-Za-z0-9]/.test(decoded)) {
      fallback.push(decoded);
    }
    literal = globalLiteral.exec(latin1);
  }

  return joinSequentialChunks(fallback);
}
