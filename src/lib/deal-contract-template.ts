import { prisma } from "@/lib/prisma";
import { getDefaultDisclaimer, getTemplateByType, renderTemplate } from "@/lib/contract-template-engine";
import { fundingTypeLabel } from "@/lib/funding-hub-db";

export async function buildDealContractBody(dealId: string, templateType?: string | null) {
  const deal = await prisma.investmentDeal.findUnique({
    where: { id: dealId },
    include: {
      project: {
        include: {
          pitches: { orderBy: { createdAt: "desc" }, take: 1, select: { productionCompany: true } },
        },
      },
      funderUser: { select: { name: true, professionalName: true } },
      creatorUser: { select: { name: true, professionalName: true } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!deal) return null;

  if (!deal?.project) return null;

  const template = getTemplateByType(templateType ?? "INVESTMENT_AGREEMENT");
  const terms = deal.termSheets[0];
  const funderName = deal.funderUser.professionalName || deal.funderUser.name || "Funder";
  const projectTitle = deal.project.title;
  const investmentLine = terms
    ? `Investment: R${terms.investmentAmount.toLocaleString("en-ZA")}${
        terms.equityPercentage != null ? ` · ${terms.equityPercentage}% equity` : ""
      }${terms.revenueSharePct != null ? ` · ${terms.revenueSharePct}% revenue share` : ""}`
    : "As per negotiated term sheet";

  const paymentTerms = terms?.recoupmentTerms?.trim()
    ? terms.recoupmentTerms
    : "Milestone-based disbursement per approved production schedule";

  const rightsGrant = terms?.recoupmentTerms?.trim()
    ? terms.recoupmentTerms
    : "Standard recoupment from net revenues after delivery, subject to agreed waterfall.";

  const milestonesNote =
    terms?.milestones && Array.isArray(terms.milestones)
      ? (terms.milestones as { label?: string; amount?: number }[])
          .map((m) => `${m.label ?? "Milestone"}: R${Number(m.amount ?? 0).toLocaleString("en-ZA")}`)
          .join("; ")
      : `Funding for ${projectTitle}`;

  return renderTemplate(template.body, {
    production_name: projectTitle,
    production_company: deal.project.pitches[0]?.productionCompany ?? "Story Time Production",
    party_name: funderName,
    party_type: fundingTypeLabel("PRIVATE"),
    role: "Investor / Funder",
    rate: investmentLine,
    payment_terms: paymentTerms,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "Upon delivery and recoupment completion",
    custom_clauses: "Deal-room terms apply. Amend via negotiated term sheet versions.",
    legal_disclaimer: getDefaultDisclaimer(),
    location_name: "N/A",
    equipment_list: "N/A",
    project_involvement: milestonesNote,
    rights_grant: rightsGrant,
    credit_terms: "Per EPK and credit agreement schedule",
    insurance_requirement: "Producer E&O and completion bond as applicable",
  });
}
