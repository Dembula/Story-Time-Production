import "server-only";

import { buildFullHtmlDocument } from "./print-html-document";

async function launchChromiumBrowser() {
  const { chromium } = await import("playwright-core");

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    const chromiumPack = await import("@sparticuz/chromium");
    return chromium.launch({
      args: chromiumPack.default.args,
      executablePath: await chromiumPack.default.executablePath(),
      headless: true,
    });
  }

  try {
    return await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    return chromium.launch({ headless: true });
  }
}

/** Server-side HTML → PDF using headless Chromium (matches print HTML layout). */
export async function htmlDocumentToPdfBuffer(fullHtml: string): Promise<Buffer> {
  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function renderDocumentPdf(options: {
  title: string;
  bodyHtml: string;
  extraCss?: string;
}): Promise<Buffer> {
  const html = buildFullHtmlDocument(options);
  return htmlDocumentToPdfBuffer(html);
}
