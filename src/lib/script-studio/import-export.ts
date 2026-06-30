export type ImportResult = {
  text: string;
  fixes: string[];
};

/** Basic client-side import repair for Fountain / plain text / rough FDX text. */
export function importScreenplayText(raw: string, filename: string): ImportResult {
  const fixes: string[] = [];
  let text = raw.replace(/\r\n/g, "\n").trim();

  if (filename.toLowerCase().endsWith(".fountain")) {
    text = text.replace(/^\.([A-Z][^\n]+)$/gm, (_, heading: string) => {
      fixes.push(`Converted Fountain scene: ${heading}`);
      return heading.startsWith("INT") || heading.startsWith("EXT") ? heading : `INT. ${heading} - DAY`;
    });
    text = text.replace(/^\^([A-Z][A-Z0-9 '.\-()]+)$/gm, "$1");
  }

  if (filename.toLowerCase().endsWith(".fdx")) {
    fixes.push("FDX imported as plain text — review scene headings.");
  }

  const lines = text.split("\n");
  const repaired: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^(INT|EXT|I\/E)/i.test(t) && !/^(INT\.|EXT\.)/i.test(t)) {
      repaired.push(t.replace(/^(INT|EXT)/i, (m) => `${m.toUpperCase()}.`));
      fixes.push("Repaired slugline punctuation");
    } else if (/^[A-Z]{2,}$/.test(t) && t.length < 40 && !t.includes(".")) {
      repaired.push(t);
      fixes.push(`Detected character cue: ${t}`);
    } else {
      repaired.push(line);
    }
  }

  return { text: repaired.join("\n"), fixes: [...new Set(fixes)].slice(0, 12) };
}

export function exportAsFountain(title: string, content: string): string {
  return `Title: ${title}\n\n${content}`;
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
