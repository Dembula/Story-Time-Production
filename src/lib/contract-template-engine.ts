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
  | "CATERING_AGREEMENT"
  | "FUNDING_AGREEMENT"
  | "GENERAL_SERVICE_AGREEMENT";

export type ContractTemplate = {
  type: ContractTemplateType;
  label: string;
  description: string;
  body: string;
  resourceKinds: Array<"ACTOR" | "CREW" | "LOCATION" | "EQUIPMENT" | "CATERING" | "FUNDING" | "GENERAL">;
  legalReferences: string[];
};

const LEGAL_DISCLAIMER_PLACEHOLDER =
  "This agreement is a production template provided by Story Time for convenience only. It is not legal advice. South African law applies unless parties agree otherwise in writing. All parties should obtain independent legal review before execution.";

const COMMON_SECTIONS = `
GOVERNING LAW & JURISDICTION
This Agreement is governed by the laws of the {{governing_law}}. The parties submit to the jurisdiction of {{jurisdiction}}.

DATA PROTECTION (POPIA)
{{popia_clause}}

INSURANCE
{{insurance_requirement}}

TERMINATION
Either party may terminate on {{termination_notice_days}} days' written notice, subject to work already performed and amounts due for approved services rendered.

DISPUTE RESOLUTION
Employment-related disputes: CCMA / Labour Court as applicable under the Labour Relations Act 66 of 1995.
Commercial disputes: good-faith negotiation, then mediation, then arbitration under AFSA rules or equivalent.

ADDITIONAL CLAUSES
{{custom_clauses}}

SIGNATURES
Producer / Production Company: _________________________ Date: __________
Counterparty: _________________________ Date: __________

DISCLAIMER
{{legal_disclaimer}}`;

const BASE_TEMPLATES: Record<ContractTemplateType, ContractTemplate> = {
  ACTOR_AGREEMENT: {
    type: "ACTOR_AGREEMENT",
    label: "Actor / Performer Agreement",
    description: "Cast engagement covering performance services, compensation, and usage rights.",
    resourceKinds: ["ACTOR", "GENERAL"],
    legalReferences: [
      "Basic Conditions of Employment Act 75 of 1997 (BCEA)",
      "Labour Relations Act 66 of 1995 (LRA)",
      "Copyright Act 98 of 1978 (performance & fixation rights)",
      "POPIA Act 4 of 2013",
    ],
    body: `PERFORMER / ACTOR AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Producer")
Performer: {{party_name}} ({{party_type}}) ("Performer")
Character / Role: {{role}}

2. ENGAGEMENT
Producer engages Performer to render acting/performance services for the Production on the dates and schedule reflected in the production call sheets and stripboard.

3. TERM & SCHEDULE
Start: {{start_date}}
End: {{end_date}}
Shoot days: {{shoot_days_count}} | Duration: {{service_duration}}
Involvement: {{project_involvement}}

4. COMPENSATION
Rate / Fee: {{rate}}
Payment Terms: {{payment_terms}}
Performer shall submit timesheets or call-sheet confirmations as required. Producer shall pay within agreed payroll cycles and applicable BCEA minimums where Performer qualifies as an employee.

5. PERFORMER OBLIGATIONS
- Attend rehearsals, fittings, and shoot days punctually and prepared.
- Follow reasonable direction of the director and production management.
- Maintain professional conduct on set and comply with health & safety rules (OHS Act 85 of 1993).
- Not disclose confidential script or production information without written consent.

6. RIGHTS & RELEASES
Performer grants Producer the right to record, use, and exploit Performer's performance in the Production and related promotional materials in all media worldwide, unless limited below.
Rights / usage: {{rights_grant}}
Credit: {{credit_terms}}

7. INDEPENDENT CONTRACTOR / EMPLOYEE STATUS
Parties intend Performer to be engaged as {{party_type}}. If classified as an employee, statutory deductions and leave provisions under BCEA/LRA apply.

8. CANCELLATION & FORCE MAJEURE
Producer may release Performer if role is cut or production halted, paying for services rendered and reasonable cancellation fees if agreed in writing.
${COMMON_SECTIONS}`,
  },
  CREW_AGREEMENT: {
    type: "CREW_AGREEMENT",
    label: "Crew Services Agreement",
    description: "Department crew hire with scope, rates, and production obligations.",
    resourceKinds: ["CREW", "GENERAL"],
    legalReferences: [
      "BCEA 75 of 1997",
      "LRA 66 of 1995",
      "OHS Act 85 of 1993",
      "POPIA Act 4 of 2013",
    ],
    body: `CREW SERVICES AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Producer")
Crew Member / Company: {{party_name}} ({{party_type}}) ("Crew")
Department / Role: {{role}}

2. SERVICES
Crew shall perform professional production services consistent with industry standards for the assigned department.

3. TERM
Start: {{start_date}} | End: {{end_date}}
Shoot days: {{shoot_days_count}} | Duration: {{service_duration}}
Scope: {{project_involvement}}

4. COMPENSATION
Rate: {{rate}}
Payment: {{payment_terms}}
Approved overtime, kit rental, and travel reimbursements require prior written approval.

5. CREW OBLIGATIONS
- Provide own tools/equipment only where agreed.
- Comply with set safety briefings and department head instructions.
- Deliver work product (files, reports, logs) as required by Producer.

6. INTELLECTUAL PROPERTY
Work product created in the course of services is assigned to Producer unless otherwise agreed. Moral rights are waived to the extent permitted by law for production exploitation.

7. CONFIDENTIALITY
Crew shall not disclose scripts, budgets, schedules, or cast/crew personal information except as required for the Production.
${COMMON_SECTIONS}`,
  },
  LOCATION_AGREEMENT: {
    type: "LOCATION_AGREEMENT",
    label: "Location Use Agreement",
    description: "Property access, filming rights, fees, and restoration obligations.",
    resourceKinds: ["LOCATION", "GENERAL"],
    legalReferences: [
      "Consumer Protection Act 68 of 2008 (where applicable)",
      "POPIA Act 4 of 2013",
      "Common-law property & nuisance principles",
    ],
    body: `LOCATION USE AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Producer")
Location: {{location_name}}
Owner / Agent: {{party_name}} ({{party_type}}) ("Location Owner")

2. GRANT OF USE
Location Owner grants Producer a limited licence to access and film at the Location for the Production during the Term.

3. TERM & HOURS
Start: {{start_date}} | End: {{end_date}}
Shoot days: {{shoot_days_count}}
Usage notes: {{project_involvement}}

4. FEES
Daily / package rate: {{rate}}
Payment terms: {{payment_terms}}
Additional fees apply for overtime, prep/wrap days, and damages beyond normal wear.

5. LOCATION OWNER OBLIGATIONS
- Provide safe access, utilities as agreed, and accurate disclosure of restrictions (heritage, strata, body corporate rules).
- Obtain necessary landlord/municipal consents where required.

6. PRODUCER OBLIGATIONS
- Restore Location to substantially the same condition (fair wear excepted).
- Carry public liability insurance naming Location Owner as additional insured where reasonably required.
Insurance: {{insurance_requirement}}

7. PERMITS & COMPLIANCE
Producer is responsible for film permits, traffic management, and noise compliance unless expressly delegated in writing.

8. INDEMNITY
Each party indemnifies the other for losses arising from its negligence or breach of this Agreement.
${COMMON_SECTIONS}`,
  },
  EQUIPMENT_RENTAL_AGREEMENT: {
    type: "EQUIPMENT_RENTAL_AGREEMENT",
    label: "Equipment Rental Agreement",
    description: "Gear rental, liability, return condition, and loss/damage terms.",
    resourceKinds: ["EQUIPMENT", "GENERAL"],
    legalReferences: [
      "Consumer Protection Act 68 of 2008",
      "National Credit Act 34 of 2005 (if hire purchase structure)",
      "POPIA Act 4 of 2013",
    ],
    body: `EQUIPMENT RENTAL AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Renter")
Supplier: {{party_name}} ({{party_type}}) ("Owner")

2. EQUIPMENT
Equipment list: {{equipment_list}}
Role / package: {{role}}

3. RENTAL PERIOD
Start: {{start_date}} | End: {{end_date}}
Duration: {{service_duration}}

4. RENTAL FEES
Rate: {{rate}}
Payment: {{payment_terms}}
Late return fees and replacement value charges apply per Owner's standard terms.

5. DELIVERY & RETURN
Equipment shall be returned in the same working order, ordinary wear excepted. Renter shall not sub-rent without consent.

6. RISK & INSURANCE
Risk passes to Renter on delivery. Renter shall maintain production insurance covering theft, loss, and damage.
Insurance: {{insurance_requirement}}

7. OPERATION
Only qualified personnel may operate specialised equipment. Owner may provide tech support if agreed.

8. LIMITATION
Owner's liability is limited to repair/replacement of defective equipment; indirect losses excluded to the extent permitted by law.
${COMMON_SECTIONS}`,
  },
  CATERING_AGREEMENT: {
    type: "CATERING_AGREEMENT",
    label: "Catering Services Agreement",
    description: "On-set meals, headcount, hygiene, and service-level terms.",
    resourceKinds: ["CATERING", "GENERAL"],
    legalReferences: [
      "Foodstuffs, Cosmetics and Disinfectants Act 54 of 1972",
      "Regulations relating to hygiene (R638)",
      "Consumer Protection Act 68 of 2008",
      "POPIA Act 4 of 2013",
    ],
    body: `CATERING SERVICES AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Producer")
Caterer: {{party_name}} ({{party_type}}) ("Caterer")

2. SERVICES
Caterer shall provide meals and craft services for cast and crew on shoot days as specified.

3. SERVICE DATES
Start: {{start_date}} | End: {{end_date}}
Shoot days: {{shoot_days_count}} | Duration: {{service_duration}}
Service notes: {{project_involvement}}

4. FEES
Rate / package: {{rate}}
Payment: {{payment_terms}}
Headcount changes within agreed notice period may adjust pricing.

5. FOOD SAFETY & COMPLIANCE
Caterer warrants compliance with applicable food hygiene regulations, allergen disclosure, and HACCP practices where required.

6. STAFF & EQUIPMENT
Caterer provides qualified staff, transport, and serving equipment unless otherwise agreed.

7. CANCELLATION
Producer cancellation within 48 hours of service may incur reasonable prep costs.

8. LIABILITY
Caterer maintains public liability insurance. Producer shall provide safe access and power/water as agreed.
Insurance: {{insurance_requirement}}
${COMMON_SECTIONS}`,
  },
  FUNDING_AGREEMENT: {
    type: "FUNDING_AGREEMENT",
    label: "Funding / Investment Agreement",
    description: "Capital contribution, recoupment, reporting, and investor protections.",
    resourceKinds: ["FUNDING", "GENERAL"],
    legalReferences: [
      "Companies Act 71 of 2008",
      "Financial Advisory and Intermediary Services Act 37 of 2002 (if applicable)",
      "National Credit Act 34 of 2005 (if loan structure)",
      "POPIA Act 4 of 2013",
    ],
    body: `PRODUCTION FUNDING AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Producer")
Funder / Investor: {{party_name}} ({{party_type}}) ("Funder")

2. PURPOSE
Funder agrees to provide funding for development, production, or delivery of the Production on the terms below.

3. TERM
Effective: {{start_date}} through {{end_date}}
Milestones: {{project_involvement}}

4. FUNDING AMOUNT & USE
Amount / rate: {{rate}}
Payment schedule: {{payment_terms}}
Producer shall use funds solely for approved budget lines and provide periodic reporting.

5. RECOUPMENT & RETURNS
Recoupment, profit participation, and waterfall terms:
{{rights_grant}}

6. REPRESENTATIONS
Producer represents it has authority to enter this Agreement and will comply with applicable tax, exchange control, and securities laws.

7. AUDIT & REPORTING
Funder may receive reasonable production reports. Formal audit rights require 14 days' notice and shall not unreasonably disrupt production.

8. CREDIT & EPK
Credit terms: {{credit_terms}}

9. CONFIDENTIALITY
Financial terms are confidential except as required for legal, accounting, or festival submission purposes.
${COMMON_SECTIONS}`,
  },
  GENERAL_SERVICE_AGREEMENT: {
    type: "GENERAL_SERVICE_AGREEMENT",
    label: "General Service Agreement",
    description: "Flexible vendor or consultant agreement for bespoke production services.",
    resourceKinds: ["GENERAL"],
    legalReferences: ["Consumer Protection Act 68 of 2008", "POPIA Act 4 of 2013"],
    body: `GENERAL SERVICE AGREEMENT

1. PARTIES
Production: {{production_name}}
Production Company: {{production_company}} ("Producer")
Service Provider: {{party_name}} ({{party_type}}) ("Provider")

2. SERVICES
Scope: {{role}}
Details: {{project_involvement}}

3. TERM
Start: {{start_date}} | End: {{end_date}}
Duration: {{service_duration}}

4. FEES
Rate: {{rate}}
Payment: {{payment_terms}}

5. STANDARD TERMS
Provider performs services professionally and complies with applicable laws. Producer provides reasonable access and information.

6. IP & DELIVERABLES
Unless agreed otherwise, deliverables are assigned to Producer upon full payment.

7. LIABILITY
Each party's aggregate liability is limited to fees paid under this Agreement, excluding fraud or wilful misconduct.
${COMMON_SECTIONS}`,
  },
};

export const SIGNED_CONTRACT_STATUSES = new Set<string>(["SIGNED", "EXECUTED", "CLOSED", "ACCEPTED", "COMPLETED"]);

export function mapLegacyContractType(type: string): ContractTemplateType {
  const normalized = (type || "").toUpperCase();
  if (normalized === "ACTOR" || normalized === "ACTOR_AGREEMENT") return "ACTOR_AGREEMENT";
  if (normalized === "CREW" || normalized === "CREW_AGREEMENT") return "CREW_AGREEMENT";
  if (normalized === "LOCATION" || normalized === "LOCATION_AGREEMENT") return "LOCATION_AGREEMENT";
  if (normalized === "VENDOR" || normalized === "EQUIPMENT" || normalized === "EQUIPMENT_RENTAL_AGREEMENT") {
    return "EQUIPMENT_RENTAL_AGREEMENT";
  }
  if (normalized === "CATERING" || normalized === "CATERING_AGREEMENT") return "CATERING_AGREEMENT";
  if (normalized === "FUNDING" || normalized === "FUNDING_AGREEMENT" || normalized === "INVESTMENT") {
    return "FUNDING_AGREEMENT";
  }
  if (normalized === "GENERAL_SERVICE_AGREEMENT") return "GENERAL_SERVICE_AGREEMENT";
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
    const val = values[key];
    if (val === undefined || val === null || String(val).trim() === "") return "[To be completed]";
    return String(val);
  });
}

export function getDefaultDisclaimer() {
  return LEGAL_DISCLAIMER_PLACEHOLDER;
}

export function statusToTone(status: string): "slate" | "blue" | "amber" | "emerald" | "red" {
  const normalized = status.toUpperCase();
  if (normalized === "DRAFT") return "slate";
  if (normalized === "SENT" || normalized === "VIEWED" || normalized === "AWAITING_SIGNATURE") return "blue";
  if (normalized === "PARTIALLY_SIGNED") return "amber";
  if (normalized === "ACCEPTED" || normalized === "SIGNED" || normalized === "EXECUTED" || normalized === "CLOSED" || normalized === "COMPLETED") {
    return "emerald";
  }
  if (normalized === "CHANGES_REQUESTED") return "amber";
  return "red";
}
