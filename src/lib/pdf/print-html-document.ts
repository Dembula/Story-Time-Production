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

/** Full standalone HTML document for print, PDF, or download. */
export function buildFullHtmlDocument(options: {
  title: string;
  bodyHtml: string;
  extraCss?: string;
}): string {
  const { title, bodyHtml, extraCss = "" } = options;
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${safeTitle}</title>
<style>${BASE_PRINT_CSS}${extraCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function openPrintPopup(html: string, autoPrint: boolean): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=900,height=1100");
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked — allow pop-ups to print this document.");
  }

  const trigger = () => {
    URL.revokeObjectURL(url);
    w.focus();
    if (autoPrint) w.print();
  };

  w.addEventListener("load", trigger);
  setTimeout(trigger, 800);
}

/** Opens print dialog with only the document — not the app shell. */
export function printHtmlDocument(options: PrintHtmlDocumentOptions): void {
  const { title, bodyHtml, autoPrint = true, extraCss = "" } = options;
  const html = buildFullHtmlDocument({ title, bodyHtml, extraCss });

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "none",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    openPrintPopup(html, autoPrint);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    openPrintPopup(html, autoPrint);
    return;
  }

  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    if (autoPrint) win.print();
    setTimeout(() => iframe.remove(), 1500);
  };

  win.addEventListener("load", runPrint);
  setTimeout(runPrint, 400);
}

/** Download the same print-ready HTML as a file (opens correctly in browser for Save as PDF). */
export function downloadHtmlDocument(options: {
  title: string;
  bodyHtml: string;
  extraCss?: string;
  filename?: string;
}): void {
  const { title, bodyHtml, extraCss = "", filename } = options;
  const html = buildFullHtmlDocument({ title, bodyHtml, extraCss });
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

/** Client-side PDF download from the same HTML used for print — matches on-screen layout. */
export async function downloadPdfFromHtmlDocument(options: {
  title: string;
  bodyHtml: string;
  extraCss?: string;
  filename?: string;
}): Promise<void> {
  const { title, bodyHtml, extraCss = "", filename } = options;
  const html = buildFullHtmlDocument({ title, bodyHtml, extraCss });

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: "8.5in",
    height: "11in",
    border: "none",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not prepare PDF export.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    if (iframe.contentWindow?.document.readyState === "complete") resolve();
    else iframe.addEventListener("load", () => resolve(), { once: true });
    setTimeout(resolve, 500);
  });

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const body = doc.body;
    const pageNodes = body.querySelectorAll<HTMLElement>(".doc-page");

    const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
    const safeName =
      filename ?? `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

    if (pageNodes.length > 0) {
      for (let i = 0; i < pageNodes.length; i++) {
        const pageEl = pageNodes[i]!;
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const img = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, 8.5, 11);
      }
    } else {
      const target = (body.firstElementChild as HTMLElement | null) ?? body;
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 816,
      });
      const pageWidth = 8.5;
      const pageHeight = 11;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      const img = canvas.toDataURL("image/jpeg", 0.92);

      pdf.addImage(img, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(img, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    pdf.save(safeName);
  } finally {
    iframe.remove();
  }
}

export { escapeHtml as escapeHtmlForDocument };
