/** Minimal PDF 1.4 generator for plain-text contracts (no external deps). */

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLines(text: string, maxChars = 90): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.length <= maxChars) {
      lines.push(raw);
      continue;
    }
    let rest = raw;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(" ", maxChars);
      const idx = cut > 40 ? cut : maxChars;
      lines.push(rest.slice(0, idx));
      rest = rest.slice(idx).trimStart();
    }
    if (rest) lines.push(rest);
  }
  return lines;
}

export function contractTermsToPdfBuffer(terms: string, title: string): Buffer {
  const header = escapePdfText(title);
  const bodyLines = wrapLines(terms);
  const streamParts = [
    "BT",
    "/F1 14 Tf",
    "50 760 Td",
    `(${header}) Tj`,
    "0 -24 Td",
    "/F1 10 Tf",
  ];
  for (const line of bodyLines) {
    streamParts.push(`(${escapePdfText(line || " ")}) Tj`);
    streamParts.push("0 -12 Td");
  }
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const parts: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];

  const add = (body: string) => {
    offsets.push(Buffer.byteLength(parts.join(""), "utf8"));
    parts.push(body);
  };

  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  add(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  add(`4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`);
  add("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const xrefOffset = Buffer.byteLength(parts.join(""), "utf8");
  parts.push(`xref\n0 ${offsets.length}\n`);
  parts.push("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    parts.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\n`);
  parts.push(`startxref\n${xrefOffset}\n%%EOF`);

  return Buffer.from(parts.join(""), "utf8");
}
