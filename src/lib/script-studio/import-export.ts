import {
  isFragmentedScreenplayImport,
  isRunTogetherGarbage,
  isCharacterSpacedGarbage,
  lightCleanScreenplayText,
  normalizeImportedScreenplayLayout,
} from "@/lib/script-studio/screenplay-layout-repair";
import { formatImportedScreenplayForPages } from "@/lib/script-studio/screenplay-keyboard";

export type ImportResult = {
  text: string;
  fixes: string[];
};

/**
 * Final client-side pass for imported screenplay text.
 * Preserves good text. Repairs broken PDF output. Formats to studio page margins.
 */
export function importScreenplayText(raw: string, filename: string): ImportResult {
  const fixes: string[] = [];
  let text = lightCleanScreenplayText(raw);

  if (text.startsWith("%PDF-")) {
    return {
      text: "",
      fixes: ["PDF files must be parsed as PDF — re-import using the .pdf file, not raw bytes."],
    };
  }

  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const needsRepair =
    isFragmentedScreenplayImport(text) ||
    isRunTogetherGarbage(text) ||
    isCharacterSpacedGarbage(text);

  if (needsRepair) {
    const layout = normalizeImportedScreenplayLayout(text);
    text = layout.text;
    fixes.push(...layout.fixes);
  } else if (isPdf) {
    // PDF extracts often still carry visual wrap hard-breaks even when not "fragmented"
    fixes.push("Preparing PDF extract for screenplay page layout");
  }

  if (lower.endsWith(".fountain")) {
    text = text.replace(/^\.([A-Z][^\n]+)$/gm, (_, heading: string) => {
      fixes.push(`Converted Fountain scene: ${heading}`);
      return heading.startsWith("INT") || heading.startsWith("EXT") ? heading : `INT. ${heading} - DAY`;
    });
    text = text.replace(/^\^([A-Z][A-Z0-9 '.\-()]+)$/gm, "$1");
  }

  if (lower.endsWith(".fdx")) {
    fixes.push("FDX imported with screenplay paragraph structure preserved.");
  }

  if (!text.trim()) {
    return {
      text: "",
      fixes: fixes.length
        ? fixes
        : ["Import produced no readable screenplay text. Try PDF, DOCX, FDX, Fountain, RTF, ODT, or plain text."],
    };
  }

  const formatted = formatImportedScreenplayForPages(text);
  if (formatted !== text) {
    fixes.push("Reflowed and hard-wrapped to US Letter screenplay margins");
  }
  text = formatted;

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
