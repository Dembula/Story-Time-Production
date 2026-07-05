import { paginateContractTerms } from "@/lib/contract-document-format";
import { watermarkForStatus } from "@/lib/contract-lifecycle-shared";

export type ContractDocumentHtmlInput = {
  title: string;
  terms: string;
  status: string;
  projectTitle?: string | null;
  productionCompany?: string | null;
  jurisdiction?: string | null;
  recipientLabel?: string | null;
  signatures?: Array<{ name: string; role: string | null; signedAt: string }>;
};

const CONTRACT_PRINT_CSS = `
.doc-page {
  position: relative;
  width: 8.5in;
  min-height: 11in;
  margin: 0 auto;
  padding: 0.75in 1in;
  box-sizing: border-box;
  font-family: "Times New Roman", Times, serif;
  font-size: 11pt;
  line-height: 1.45;
  color: #111;
  background: #fff;
  page-break-after: always;
}
.doc-page:last-child { page-break-after: auto; }
.doc-watermark {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.doc-watermark span {
  font-size: 4.5rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  opacity: 0.08;
  transform: rotate(-35deg);
  white-space: nowrap;
}
.doc-header {
  border-bottom: 1px solid rgba(0,0,0,0.2);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
  font-size: 10pt;
}
.doc-header-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.doc-company {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 9pt;
}
.doc-meta { text-align: right; color: rgba(0,0,0,0.55); }
.doc-title {
  text-align: center;
  font-size: 14pt;
  font-weight: 700;
  margin: 1rem 0 0.25rem;
}
.doc-party {
  text-align: center;
  font-size: 10pt;
  color: rgba(0,0,0,0.65);
}
.doc-body { white-space: pre-wrap; }
.doc-footer-signatures {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0,0,0,0.2);
  font-size: 10pt;
}
.doc-sig-line {
  margin-top: 0.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.35);
  width: 12rem;
}
.doc-page-num {
  position: absolute;
  bottom: 0.5in;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9pt;
  color: rgba(0,0,0,0.45);
}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headerHtml(input: ContractDocumentHtmlInput): string {
  const company = input.productionCompany
    ? `<p class="doc-company">${escapeHtml(input.productionCompany)}</p>`
    : "";
  const project = input.projectTitle
    ? `<p style="margin-top:0.15rem;color:rgba(0,0,0,0.65)">${escapeHtml(input.projectTitle)}</p>`
    : "";
  const jurisdiction = input.jurisdiction ? `<p>${escapeHtml(input.jurisdiction)}</p>` : "";
  const party = input.recipientLabel
    ? `<p class="doc-party">Party: ${escapeHtml(input.recipientLabel)}</p>`
    : "";

  return `<header class="doc-header">
  <div class="doc-header-top">
    <div>${company}${project}</div>
    <div class="doc-meta">${jurisdiction}<p style="margin-top:0.25rem">Confidential</p></div>
  </div>
  <h1 class="doc-title">${escapeHtml(input.title)}</h1>
  ${party}
</header>`;
}

function signaturesHtml(signatures: ContractDocumentHtmlInput["signatures"]): string {
  if (!signatures?.length) return "";
  const rows = signatures
    .map(
      (sig) =>
        `<div style="margin-bottom:1rem">
          <p style="font-weight:600">${escapeHtml(sig.name)}${sig.role ? ` — ${escapeHtml(sig.role)}` : ""}</p>
          <p style="color:rgba(0,0,0,0.55)">Signed ${escapeHtml(new Date(sig.signedAt).toLocaleString())}</p>
          <div class="doc-sig-line"></div>
        </div>`,
    )
    .join("");
  return `<footer class="doc-footer-signatures">
    <p style="font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Execution</p>
    ${rows}
  </footer>`;
}

/** Multi-page contract HTML matching the in-app ContractDocumentViewer layout. */
export function buildContractDocumentHtml(input: ContractDocumentHtmlInput): {
  bodyHtml: string;
  extraCss: string;
  pageCount: number;
} {
  const pages = paginateContractTerms(input.terms);
  const watermark = watermarkForStatus(input.status);
  const header = headerHtml(input);
  const sigs = signaturesHtml(input.signatures);

  const pageHtml = pages
    .map((content, index) => {
      const isLast = index === pages.length - 1;
      const watermarkEl = watermark
        ? `<div class="doc-watermark" aria-hidden="true"><span>${escapeHtml(watermark)}</span></div>`
        : "";
      return `<section class="doc-page">
  ${watermarkEl}
  ${index === 0 ? header : ""}
  <article class="doc-body">${escapeHtml(content)}</article>
  ${isLast ? sigs : ""}
  <div class="doc-page-num">Page ${index + 1} of ${pages.length}</div>
</section>`;
    })
    .join("\n");

  return { bodyHtml: pageHtml, extraCss: CONTRACT_PRINT_CSS, pageCount: pages.length };
}

export function contractDocumentPrintTitle(input: ContractDocumentHtmlInput): string {
  return input.projectTitle ? `${input.projectTitle} — ${input.title}` : input.title;
}
