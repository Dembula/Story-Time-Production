export const PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "PARTIAL",
  "CLOSED",
  "CANCELLED",
  "REJECTED",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

export const PAYROLL_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PAID", "CANCELLED"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const BUDGET_VERSION_STATUSES = ["DRAFT", "LOCKED", "ARCHIVED"] as const;
export type BudgetVersionStatus = (typeof BUDGET_VERSION_STATUSES)[number];

export const VENDOR_TYPES = ["GENERAL", "CREW", "EQUIPMENT", "LOCATION", "CATERING"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

export function poStatusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
