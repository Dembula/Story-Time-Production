/** Contract PDF export — same HTML layout as ContractDocumentViewer preview. */

import { buildContractDocumentHtml } from "@/lib/legal/contract-document-html";
import { renderDocumentPdf } from "@/lib/pdf/html-to-pdf-server";

export type ContractPdfMeta = {
  title: string;
  terms: string;
  status?: string;
  projectTitle?: string | null;
  productionCompany?: string | null;
  jurisdiction?: string | null;
  recipientLabel?: string | null;
  signatures?: Array<{ name: string; role: string | null; signedAt: string }>;
};

export async function contractTermsToPdfBuffer(terms: string, title: string): Promise<Buffer> {
  return contractDocumentToPdfBuffer({ title, terms });
}

export async function contractDocumentToPdfBuffer(meta: ContractPdfMeta): Promise<Buffer> {
  const { bodyHtml, extraCss } = buildContractDocumentHtml({
    title: meta.title,
    terms: meta.terms,
    status: meta.status ?? "DRAFT",
    projectTitle: meta.projectTitle,
    productionCompany: meta.productionCompany,
    jurisdiction: meta.jurisdiction,
    recipientLabel: meta.recipientLabel,
    signatures: meta.signatures,
  });

  return renderDocumentPdf({
    title: meta.projectTitle ? `${meta.projectTitle} — ${meta.title}` : meta.title,
    bodyHtml,
    extraCss,
  });
}
