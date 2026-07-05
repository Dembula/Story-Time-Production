/** Contract PDF export — multi-page formatted document (not a screen capture). */

import { buildDocumentPdf, type PdfBlock } from "@/lib/pdf/document-pdf";

export function contractTermsToPdfBuffer(terms: string, title: string): Buffer {
  const blocks: PdfBlock[] = [
    { type: "title", text: "CONTRACT" },
    { type: "subtitle", text: title },
    { type: "blank" },
  ];

  for (const paragraph of terms.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const text = paragraph.trim();
    if (!text) continue;
    // Treat ALL-CAPS short lines as section headings
    if (text.length < 80 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
      blocks.push({ type: "heading", text });
    } else {
      for (const line of text.split("\n")) {
        blocks.push({ type: "line", text: line });
      }
      blocks.push({ type: "blank" });
    }
  }

  blocks.push(
    { type: "blank" },
    { type: "line", text: `Exported ${new Date().toLocaleString()} · Story Time` },
  );

  return buildDocumentPdf({
    title,
    footer: title,
    blocks,
  });
}
