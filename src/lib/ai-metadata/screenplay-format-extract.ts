import "server-only";

const MAX_SCRIPT_CHARS = 120_000;

function truncateScriptText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_SCRIPT_CHARS) return normalized;
  return `${normalized.slice(0, MAX_SCRIPT_CHARS)}\n\n[…script truncated for import…]`;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/** Parse Final Draft (.fdx) XML into plain screenplay lines. */
export function extractFdxText(raw: string): string {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed.includes("<FinalDraft") && !trimmed.includes("<Paragraph")) {
    return truncateScriptText(trimmed);
  }

  const lines: string[] = [];
  const paragraphRe = /<Paragraph\b[^>]*\bType="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let paragraphMatch = paragraphRe.exec(trimmed);
  while (paragraphMatch) {
    const inner = paragraphMatch[2] ?? "";
    const textRe = /<Text\b[^>]*>([\s\S]*?)<\/Text>/gi;
    const parts: string[] = [];
    let textMatch = textRe.exec(inner);
    while (textMatch) {
      const decoded = stripXmlTags(textMatch[1] ?? "");
      if (decoded) parts.push(decoded);
      textMatch = textRe.exec(inner);
    }
    const line = parts.join("").trim();
    if (line) lines.push(line);
    paragraphMatch = paragraphRe.exec(trimmed);
  }

  if (lines.length === 0) {
    return truncateScriptText(stripXmlTags(trimmed));
  }
  return truncateScriptText(lines.join("\n"));
}

/** Basic RTF to plain text (screenplay exports, Word RTF, etc.). */
export function extractRtfText(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "");
  text = text.replace(/\\u(-?\d+)\??/g, (_, code: string) =>
    String.fromCharCode(Number(code) & 0xffff),
  );
  text = text.replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  text = text.replace(/\\par[d]?/gi, "\n");
  text = text.replace(/\\line/gi, "\n");
  text = text.replace(/\\tab/gi, "\t");
  text = text.replace(/\{\\\*\\[a-z]+[\s\S]*?\}/gi, "");
  text = text.replace(/\\[a-z]+-?\d* ?/gi, "");
  text = text.replace(/[{}]/g, "");
  return truncateScriptText(text);
}

/** Extract text from OpenDocument Text (.odt) via content.xml. */
export async function extractOdtText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file("content.xml")?.async("string");
  if (!contentXml) return "";

  const lines: string[] = [];
  const paragraphRe = /<text:p[^>]*>([\s\S]*?)<\/text:p>/gi;
  let match = paragraphRe.exec(contentXml);
  while (match) {
    const line = stripXmlTags(match[1] ?? "");
    if (line) lines.push(line);
    match = paragraphRe.exec(contentXml);
  }

  if (lines.length === 0) {
    return truncateScriptText(
      contentXml
        .replace(/<text:line-break\/>/g, "\n")
        .replace(/<[^>]+>/g, "\n")
        .replace(/\n{2,}/g, "\n"),
    );
  }

  return truncateScriptText(lines.join("\n"));
}

/** Decode plain-text uploads that may be UTF-16 LE/BE. */
export function decodePlainTextBuffer(buffer: Buffer): string {
  if (buffer.length >= 2) {
    const b0 = buffer[0];
    const b1 = buffer[1];
    if (b0 === 0xff && b1 === 0xfe) {
      return buffer.subarray(2).toString("utf16le");
    }
    if (b0 === 0xfe && b1 === 0xff) {
      const swapped = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i + 1 < buffer.length; i += 2) {
        swapped[i - 2] = buffer[i + 1];
        swapped[i - 1] = buffer[i];
      }
      return swapped.toString("utf16le");
    }
  }

  const utf8 = buffer.toString("utf8");
  if (utf8.includes("\uFFFD") && buffer.length % 2 === 0) {
    const utf16 = buffer.toString("utf16le");
    if ((utf16.match(/[A-Za-z]/g)?.length ?? 0) > (utf8.match(/[A-Za-z]/g)?.length ?? 0)) {
      return utf16;
    }
  }
  return utf8;
}

export { truncateScriptText };
