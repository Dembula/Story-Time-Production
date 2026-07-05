/** Open a clean print window with only document content (no app chrome, URL, or nav). */

export type PrintHtmlDocumentOptions = {
  title: string;
  bodyHtml: string;
  /** Trigger the browser print dialog when the window loads. Default true. */
  autoPrint?: boolean;
  /** Extra CSS appended after the base print styles. */
  extraCss?: string;
};

const BASE_PRINT_CSS = `
@page { size: letter; margin: 0; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@media print {
  html, body { margin: 0; padding: 0; }
}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Opens a dedicated popup/print window — only the document is printed, not the app shell. */
export function printHtmlDocument(options: PrintHtmlDocumentOptions): void {
  const { title, bodyHtml, autoPrint = true, extraCss = "" } = options;
  const safeTitle = escapeHtml(title);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeTitle}</title>
<style>${BASE_PRINT_CSS}${extraCss}</style>
</head>
<body>
${bodyHtml}
${autoPrint ? "<script>window.addEventListener('load', () => { window.focus(); window.print(); });</script>" : ""}
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!w) {
    throw new Error("Pop-up blocked — allow pop-ups to print this document.");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Download the same print-ready HTML as a file (opens correctly in browser for Save as PDF). */
export function downloadHtmlDocument(options: { title: string; bodyHtml: string; extraCss?: string; filename?: string }): void {
  const { title, bodyHtml, extraCss = "", filename } = options;
  const safeTitle = escapeHtml(title);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${safeTitle}</title>
<style>${BASE_PRINT_CSS}${extraCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { escapeHtml as escapeHtmlForDocument };
