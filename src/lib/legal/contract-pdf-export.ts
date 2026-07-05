/** Contract PDF export — paginated layout aligned with ContractDocumentViewer preview. */

import { paginateContractTerms } from "@/lib/contract-document-format";
import { watermarkForStatus } from "@/lib/contract-lifecycle-shared";
import { buildDocumentPdf, type PdfBlock } from "@/lib/pdf/document-pdf";

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

export function contractTermsToPdfBuffer(terms: string, title: string): Buffer {
  return contractDocumentToPdfBuffer({ title, terms });
}

export function contractDocumentToPdfBuffer(meta: ContractPdfMeta): Buffer {
  const {
    title,
    terms,
    status = "DRAFT",
    projectTitle,
    productionCompany,
    jurisdiction,
    recipientLabel,
    signatures = [],
  } = meta;

  const watermark = watermarkForStatus(status);
  const pages = paginateContractTerms(terms);
  const blocks: PdfBlock[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (pageIndex > 0) {
      blocks.push({ type: "heading", text: `— Page ${pageIndex + 1} —` });
    }

    if (pageIndex === 0) {
      blocks.push({ type: "title", text: "CONTRACT" });
      blocks.push({ type: "subtitle", text: title });
      if (productionCompany) blocks.push({ type: "line", text: productionCompany.toUpperCase() });
      if (projectTitle) blocks.push({ type: "line", text: projectTitle });
      if (jurisdiction) blocks.push({ type: "kv", label: "Jurisdiction", value: jurisdiction });
      if (recipientLabel) blocks.push({ type: "kv", label: "Party", value: recipientLabel });
      if (watermark) blocks.push({ type: "line", text: `[ ${watermark} ]` });
      blocks.push({ type: "blank" });
    } else if (watermark) {
      blocks.push({ type: "line", text: `[ ${watermark} ]` });
      blocks.push({ type: "blank" });
    }

    for (const line of pages[pageIndex]!.split("\n")) {
      blocks.push({ type: "line", text: line });
    }

    const isLast = pageIndex === pages.length - 1;
    if (isLast && signatures.length > 0) {
      blocks.push({ type: "blank" });
      blocks.push({ type: "heading", text: "Execution" });
      for (const sig of signatures) {
        blocks.push({
          type: "line",
          text: `${sig.name}${sig.role ? ` — ${sig.role}` : ""}`,
        });
        blocks.push({
          type: "line",
          text: `Signed ${new Date(sig.signedAt).toLocaleString()}`,
        });
        blocks.push({ type: "blank" });
      }
    }

    blocks.push({ type: "blank" });
    blocks.push({
      type: "line",
      text: `Page ${pageIndex + 1} of ${pages.length}`,
    });
    blocks.push({ type: "blank" });
  }

  const footer = projectTitle ? `${projectTitle} — ${title}` : title;
  return buildDocumentPdf({ title, footer, blocks });
}
