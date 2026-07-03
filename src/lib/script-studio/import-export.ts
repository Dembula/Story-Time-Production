import { normalizeImportedScreenplayLayout } from "@/lib/script-studio/screenplay-layout-repair";

export type ImportResult = {
  text: string;
  fixes: string[];
};

/** Client-side import repair for Fountain / plain text / PDF-extracted screenplays. */
export function importScreenplayText(raw: string, filename: string): ImportResult {
  const fixes: string[] = [];
  let text = raw.replace(/\r\n/g, "\n").trim();

  if (text.startsWith("%PDF-")) {
    return {
      text: "",
      fixes: ["PDF files must be parsed as PDF — re-import using the .pdf file, not raw bytes."],
    };
  }

  const layout = normalizeImportedScreenplayLayout(text);
  text = layout.text;
  fixes.push(...layout.fixes);

  if (filename.toLowerCase().endsWith(".fountain")) {
    text = text.replace(/^\.([A-Z][^\n]+)$/gm, (_, heading: string) => {
      fixes.push(`Converted Fountain scene: ${heading}`);
      return heading.startsWith("INT") || heading.startsWith("EXT") ? heading : `INT. ${heading} - DAY`;
    });
    text = text.replace(/^\^([A-Z][A-Z0-9 '.\-()]+)$/gm, "$1");
  }

  if (filename.toLowerCase().endsWith(".fdx")) {
    fixes.push("FDX imported — review scene headings and formatting.");
  }

  return { text, fixes: [...new Set(fixes)].slice(0, 12) };
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
