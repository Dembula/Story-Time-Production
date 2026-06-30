import type { Jurisdiction } from "@/lib/contract-template-catalog";

export type ClausePackSection = {
  governingLaw: string;
  jurisdictionCourts: string;
  popiaClause: string;
  mandatoryClauses: string[];
};

const PACKS: Record<string, ClausePackSection> = {
  "South Africa": {
    governingLaw: "Republic of South Africa",
    jurisdictionCourts: "High Court of South Africa, Gauteng Division",
    popiaClause:
      "Each party shall process personal information only as required for this production and in compliance with POPIA (Act 4 of 2013).",
    mandatoryClauses: [
      "Labour Relations Act 66 of 1995 applies to employment relationships where applicable.",
      "Basic Conditions of Employment Act 75 of 1997 minimum standards apply unless superseded by a valid collective agreement.",
      "Copyright Act 98 of 1978 governs authorship and exploitation of creative works.",
    ],
  },
  "United States": {
    governingLaw: "State of California, United States",
    jurisdictionCourts: "State and federal courts located in Los Angeles County, California",
    popiaClause:
      "Each party shall comply with applicable US privacy laws including CCPA/CPRA where personal information of California residents is processed.",
    mandatoryClauses: [
      "Work-for-hire provisions apply only where permitted under US Copyright Act §101.",
      "California Labor Code independent contractor classification rules are acknowledged where applicable.",
    ],
  },
  "United Kingdom": {
    governingLaw: "England and Wales",
    jurisdictionCourts: "Courts of England and Wales",
    popiaClause:
      "Each party shall process personal data in accordance with UK GDPR and the Data Protection Act 2018.",
    mandatoryClauses: [
      "Intellectual Property Assignment provisions comply with Copyright, Designs and Patents Act 1988.",
      "IR35 / off-payroll working rules are acknowledged for contractor engagements where applicable.",
    ],
  },
  Canada: {
    governingLaw: "Province of Ontario, Canada",
    jurisdictionCourts: "Courts of Ontario",
    popiaClause: "Each party shall comply with PIPEDA and applicable provincial privacy legislation.",
    mandatoryClauses: [
      "Canadian content and tax credit representations are made only where expressly stated in schedules.",
    ],
  },
  Australia: {
    governingLaw: "New South Wales, Australia",
    jurisdictionCourts: "Courts of New South Wales",
    popiaClause: "Each party shall comply with the Privacy Act 1988 (Cth) and applicable APPs.",
    mandatoryClauses: ["Screen industry MEAA minimums are referenced only where attached as a schedule."],
  },
  "European Union": {
    governingLaw: "Republic of Ireland (EU member)",
    jurisdictionCourts: "Courts of Dublin, Ireland",
    popiaClause: "Each party shall comply with GDPR (EU) 2016/679.",
    mandatoryClauses: ["Cross-border personal data transfers require appropriate safeguards under GDPR Chapter V."],
  },
  Nigeria: {
    governingLaw: "Federal Republic of Nigeria",
    jurisdictionCourts: "High Court of Lagos State",
    popiaClause: "Each party shall comply with the Nigeria Data Protection Act 2023.",
    mandatoryClauses: ["National Film and Video Censors Board requirements apply to theatrical release where relevant."],
  },
  India: {
    governingLaw: "Republic of India",
    jurisdictionCourts: "Courts at Mumbai, Maharashtra",
    popiaClause: "Each party shall comply with the Digital Personal Data Protection Act 2023.",
    mandatoryClauses: ["Copyright Act 1957 governs underlying literary and musical works."],
  },
  "New Zealand": {
    governingLaw: "New Zealand",
    jurisdictionCourts: "Courts of New Zealand",
    popiaClause: "Each party shall comply with the Privacy Act 2020.",
    mandatoryClauses: ["Screen Industry Guild rates apply only where attached as a schedule."],
  },
};

export function getClausePack(jurisdiction: string): ClausePackSection {
  return PACKS[jurisdiction] ?? PACKS["South Africa"];
}

export function applyClausePackToFields(
  fields: Record<string, string>,
  jurisdiction: string,
  extraClauses: string[] = [],
): Record<string, string> {
  const pack = getClausePack(jurisdiction);
  const mandatory = [...pack.mandatoryClauses, ...extraClauses].filter(Boolean);
  const customBlock = [
    fields.custom_clauses?.trim(),
    mandatory.length ? `\n\n--- Jurisdiction pack (${jurisdiction}) ---\n${mandatory.join("\n\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ...fields,
    governing_law: pack.governingLaw,
    jurisdiction: pack.jurisdictionCourts,
    popia_clause: pack.popiaClause,
    custom_clauses: customBlock.trim(),
  };
}

export function listClausePackJurisdictions(): Jurisdiction[] {
  return Object.keys(PACKS) as Jurisdiction[];
}
