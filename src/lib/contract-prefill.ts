import {
  getDefaultDisclaimer,
  getTemplateByType,
  mapLegacyContractType,
  renderTemplate,
  type ContractTemplateType,
} from "@/lib/contract-template-engine";

export type ContractResourceKind =
  | "ACTOR"
  | "CREW"
  | "LOCATION"
  | "EQUIPMENT"
  | "CATERING"
  | "FUNDING"
  | "GENERAL";

export type ContractResourceOption = {
  id: string;
  kind: ContractResourceKind;
  label: string;
  partyName: string;
  partyType: "INDIVIDUAL" | "COMPANY";
  role: string;
  rate: string;
  paymentTerms: string;
  startDate: string;
  endDate: string;
  projectInvolvement: string;
  locationName: string;
  equipmentList: string;
  shootDaysCount: string;
  serviceDuration: string;
  counterpartyUserId: string | null;
  castingTalentId: string | null;
  crewTeamId: string | null;
  locationListingId: string | null;
  vendorName: string | null;
};

export type ContractProjectContext = {
  id: string;
  title: string;
  productionCompany: string;
  startDate: string;
  endDate: string;
  shootDaysCount: number;
};

export type ContractFieldValues = Record<string, string>;

export const EMPTY_FIELD = "";

export function emptyFieldValues(): ContractFieldValues {
  return {
    production_name: EMPTY_FIELD,
    production_company: EMPTY_FIELD,
    party_name: EMPTY_FIELD,
    party_type: EMPTY_FIELD,
    role: EMPTY_FIELD,
    rate: EMPTY_FIELD,
    payment_terms: EMPTY_FIELD,
    start_date: EMPTY_FIELD,
    end_date: EMPTY_FIELD,
    project_involvement: EMPTY_FIELD,
    location_name: EMPTY_FIELD,
    equipment_list: EMPTY_FIELD,
    shoot_days_count: EMPTY_FIELD,
    service_duration: EMPTY_FIELD,
    governing_law: "Republic of South Africa",
    jurisdiction: "South African courts",
    insurance_requirement: EMPTY_FIELD,
    credit_terms: EMPTY_FIELD,
    rights_grant: EMPTY_FIELD,
    termination_notice_days: "7",
    popia_clause:
      "Each party shall process personal information only as required for this production and in compliance with POPIA (Act 4 of 2013).",
    custom_clauses: EMPTY_FIELD,
    legal_disclaimer: getDefaultDisclaimer(),
  };
}

export function projectFieldValues(project: ContractProjectContext): ContractFieldValues {
  const base = emptyFieldValues();
  const days = project.shootDaysCount;
  return {
    ...base,
    production_name: project.title,
    production_company: project.productionCompany,
    start_date: project.startDate !== "TBD" ? project.startDate : EMPTY_FIELD,
    end_date: project.endDate !== "TBD" ? project.endDate : EMPTY_FIELD,
    shoot_days_count: days > 0 ? String(days) : EMPTY_FIELD,
    service_duration: days > 0 ? `${days} scheduled shoot day${days === 1 ? "" : "s"}` : EMPTY_FIELD,
    project_involvement:
      days > 0
        ? `Production schedule: ${days} shoot day${days === 1 ? "" : "s"} (${project.startDate} to ${project.endDate})`
        : EMPTY_FIELD,
  };
}

export function resourceFieldValues(resource: ContractResourceOption): ContractFieldValues {
  return {
    party_name: resource.partyName || EMPTY_FIELD,
    party_type: resource.partyType || EMPTY_FIELD,
    role: resource.role || EMPTY_FIELD,
    rate: resource.rate !== "TBD" ? resource.rate : EMPTY_FIELD,
    payment_terms: resource.paymentTerms || EMPTY_FIELD,
    start_date: resource.startDate !== "TBD" ? resource.startDate : EMPTY_FIELD,
    end_date: resource.endDate !== "TBD" ? resource.endDate : EMPTY_FIELD,
    project_involvement: resource.projectInvolvement || EMPTY_FIELD,
    location_name: resource.locationName !== "N/A" ? resource.locationName : EMPTY_FIELD,
    equipment_list: resource.equipmentList !== "N/A" ? resource.equipmentList : EMPTY_FIELD,
    shoot_days_count: resource.shootDaysCount || EMPTY_FIELD,
    service_duration: resource.serviceDuration || EMPTY_FIELD,
  };
}

export function mergeFieldValues(...layers: Partial<ContractFieldValues>[]): ContractFieldValues {
  const base = emptyFieldValues();
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        base[key] = String(value);
      }
    }
  }
  return base;
}

export function templateTypeForResourceKind(kind: ContractResourceKind): ContractTemplateType {
  if (kind === "ACTOR") return "ACTOR_AGREEMENT";
  if (kind === "CREW") return "CREW_AGREEMENT";
  if (kind === "LOCATION") return "LOCATION_AGREEMENT";
  if (kind === "EQUIPMENT") return "EQUIPMENT_RENTAL_AGREEMENT";
  if (kind === "CATERING") return "CATERING_AGREEMENT";
  if (kind === "FUNDING") return "FUNDING_AGREEMENT";
  return "GENERAL_SERVICE_AGREEMENT";
}

export function resourceKindForTemplateType(type: string): ContractResourceKind {
  const normalized = mapLegacyContractType(type);
  if (normalized === "ACTOR_AGREEMENT") return "ACTOR";
  if (normalized === "CREW_AGREEMENT") return "CREW";
  if (normalized === "LOCATION_AGREEMENT") return "LOCATION";
  if (normalized === "EQUIPMENT_RENTAL_AGREEMENT") return "EQUIPMENT";
  if (normalized === "CATERING_AGREEMENT") return "CATERING";
  if (normalized === "FUNDING_AGREEMENT") return "FUNDING";
  return "GENERAL";
}

export function buildRenderedContract(
  templateType: string,
  fields: ContractFieldValues,
  templateBodyOverride?: string,
): string {
  const template = getTemplateByType(templateType);
  const body = templateBodyOverride?.trim() || template.body;
  return renderTemplate(body, fields);
}

export const EDITABLE_CONTRACT_FIELDS: Array<{ key: keyof ContractFieldValues; label: string; multiline?: boolean }> = [
  { key: "production_name", label: "Production / show title" },
  { key: "production_company", label: "Production company" },
  { key: "party_name", label: "Counterparty name" },
  { key: "party_type", label: "Counterparty type (Individual / Company)" },
  { key: "role", label: "Role / service scope" },
  { key: "rate", label: "Rate / fee" },
  { key: "payment_terms", label: "Payment terms" },
  { key: "start_date", label: "Start date" },
  { key: "end_date", label: "End date" },
  { key: "shoot_days_count", label: "Shoot days count" },
  { key: "service_duration", label: "Service duration" },
  { key: "project_involvement", label: "Project involvement / schedule notes" },
  { key: "location_name", label: "Location name" },
  { key: "equipment_list", label: "Equipment list" },
  { key: "insurance_requirement", label: "Insurance requirements" },
  { key: "credit_terms", label: "Credit / billing terms" },
  { key: "rights_grant", label: "Rights / usage grant" },
  { key: "termination_notice_days", label: "Termination notice (days)" },
  { key: "governing_law", label: "Governing law" },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "popia_clause", label: "POPIA / data protection", multiline: true },
  { key: "custom_clauses", label: "Additional clauses", multiline: true },
];

export function isContractEditable(status: string): boolean {
  const s = status.toUpperCase();
  return s === "DRAFT" || s === "CHANGES_REQUESTED" || s === "REJECTED";
}

export function isContractViewOnly(status: string): boolean {
  const s = status.toUpperCase();
  return s === "SIGNED" || s === "EXECUTED" || s === "CLOSED" || s === "ACCEPTED" || s === "COMPLETED";
}
