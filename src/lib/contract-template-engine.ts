export const CONTRACT_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  VIEWED: "VIEWED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  SIGNED: "SIGNED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;

export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

export type ContractTemplateType =
  | "ACTOR_AGREEMENT"
  | "CREW_AGREEMENT"
  | "LOCATION_AGREEMENT"
  | "EQUIPMENT_RENTAL_AGREEMENT"
  | "GENERAL_SERVICE_AGREEMENT";

export type ContractTemplate = {
  type: ContractTemplateType;
  label: string;
  description: string;
  body: string;
};

const LEGAL_DISCLAIMER_PLACEHOLDER =
  "This agreement is a customizable production template provided by Story Time. Parties should obtain independent legal advice before execution.";

const BASE_TEMPLATES: Record<ContractTemplateType, ContractTemplate> = {
  ACTOR_AGREEMENT: {
    type: "ACTOR_AGREEMENT",
    label: "Actor Agreement",
    description: "Performer engagement terms for cast members.",
    body: `ACTOR AGREEMENT

Production: {{production_name}}
Production Company: {{production_company}}
Party: {{party_name}} ({{party_type}})
Role: {{role}}
Rate: {{rate}}
Payment Terms: {{payment_terms}}
Engagement Dates: {{start_date}} to {{end_date}}
Project Involvement: {{project_involvement}}

Additional Clauses:
{{custom_clauses}}

Disclaimer:
{{legal_disclaimer}}`,
  },
  CREW_AGREEMENT: {
    type: "CREW_AGREEMENT",
    label: "Crew Agreement",
    description: "Crew services and department obligations.",
    body: `CREW AGREEMENT

Production: {{production_name}}
Production Company: {{production_company}}
Party: {{party_name}} ({{party_type}})
Department / Role: {{role}}
Rate: {{rate}}
Payment Terms: {{payment_terms}}
Service Dates: {{start_date}} to {{end_date}}
Assigned Production Days: {{project_involvement}}

Additional Clauses:
{{custom_clauses}}

Disclaimer:
{{legal_disclaimer}}`,
  },
  LOCATION_AGREEMENT: {
    type: "LOCATION_AGREEMENT",
    label: "Location Agreement",
    description: "Location usage rights and operational terms.",
    body: `LOCATION AGREEMENT

Production: {{production_name}}
Production Company: {{production_company}}
Location: {{location_name}}
Counterparty: {{party_name}} ({{party_type}})
Usage Dates: {{start_date}} to {{end_date}}
Rate: {{rate}}
Payment Terms: {{payment_terms}}
Usage Notes: {{project_involvement}}

Additional Clauses:
{{custom_clauses}}

Disclaimer:
{{legal_disclaimer}}`,
  },
  EQUIPMENT_RENTAL_AGREEMENT: {
    type: "EQUIPMENT_RENTAL_AGREEMENT",
    label: "Equipment Rental Agreement",
    description: "Rental and liability terms for equipment supply.",
    body: `EQUIPMENT RENTAL AGREEMENT

Production: {{production_name}}
Production Company: {{production_company}}
Provider: {{party_name}} ({{party_type}})
Equipment List: {{equipment_list}}
Rental Period: {{start_date}} to {{end_date}}
Rate: {{rate}}
Payment Terms: {{payment_terms}}

Additional Clauses:
{{custom_clauses}}

Disclaimer:
{{legal_disclaimer}}`,
  },
  GENERAL_SERVICE_AGREEMENT: {
    type: "GENERAL_SERVICE_AGREEMENT",
    label: "General Service Agreement",
    description: "Fallback for paid services and bespoke vendors.",
    body: `GENERAL SERVICE AGREEMENT

Production: {{production_name}}
Production Company: {{production_company}}
Service Provider: {{party_name}} ({{party_type}})
Service Scope / Role: {{role}}
Service Period: {{start_date}} to {{end_date}}
Rate: {{rate}}
Payment Terms: {{payment_terms}}

Additional Clauses:
{{custom_clauses}}

Disclaimer:
{{legal_disclaimer}}`,
  },
};

export const SIGNED_CONTRACT_STATUSES = new Set<string>(["SIGNED", "EXECUTED", "CLOSED"]);

export function mapLegacyContractType(type: string): ContractTemplateType {
  const normalized = (type || "").toUpperCase();
  if (normalized === "ACTOR" || normalized === "ACTOR_AGREEMENT") return "ACTOR_AGREEMENT";
  if (normalized === "CREW" || normalized === "CREW_AGREEMENT") return "CREW_AGREEMENT";
  if (normalized === "LOCATION" || normalized === "LOCATION_AGREEMENT") return "LOCATION_AGREEMENT";
  if (normalized === "VENDOR" || normalized === "EQUIPMENT" || normalized === "EQUIPMENT_RENTAL_AGREEMENT") {
    return "EQUIPMENT_RENTAL_AGREEMENT";
  }
  return "GENERAL_SERVICE_AGREEMENT";
}

export function getContractTemplates(): ContractTemplate[] {
  return Object.values(BASE_TEMPLATES);
}

export function getTemplateByType(type: string): ContractTemplate {
  return BASE_TEMPLATES[mapLegacyContractType(type)];
}

export function getTemplatePlaceholders(templateBody: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match = re.exec(templateBody);
  while (match) {
    if (match[1]) found.add(match[1]);
    match = re.exec(templateBody);
  }
  return [...found];
}

export function renderTemplate(templateBody: string, values: Record<string, string | null | undefined>): string {
  return templateBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (key === "legal_disclaimer") return values.legal_disclaimer || LEGAL_DISCLAIMER_PLACEHOLDER;
    return values[key] ?? "";
  });
}

export function getDefaultDisclaimer() {
  return LEGAL_DISCLAIMER_PLACEHOLDER;
}

export function statusToTone(status: string): "slate" | "blue" | "amber" | "emerald" | "red" {
  const normalized = status.toUpperCase();
  if (normalized === "DRAFT") return "slate";
  if (normalized === "SENT" || normalized === "VIEWED") return "blue";
  if (normalized === "ACCEPTED" || normalized === "SIGNED" || normalized === "EXECUTED" || normalized === "CLOSED") {
    return "emerald";
  }
  if (normalized === "CHANGES_REQUESTED") return "amber";
  return "red";
}
