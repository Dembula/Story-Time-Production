import { BUDGET_DEPARTMENTS } from "@/lib/budget-engine";
import { friendlyDepartmentName } from "@/components/budget/budget-studio-nav";

/** Production departments for budget line assignment. */
export const BUDGET_DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  ...BUDGET_DEPARTMENTS.map((d) => ({ value: d, label: friendlyDepartmentName(d) })),
  { value: "PROPS", label: "Props" },
  { value: "WARDROBE", label: "Wardrobe" },
  { value: "CASTING", label: "Casting & extras" },
  { value: "STUNTS", label: "Stunts" },
  { value: "SFX", label: "Special effects" },
  { value: "HAIR_MAKEUP", label: "Hair & makeup" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "CONTINGENCY", label: "Contingency" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "PERMITS", label: "Permits & legal" },
  { value: "TAXES", label: "Taxes" },
  { value: "MANUAL", label: "Other / general" },
].filter((opt, i, arr) => arr.findIndex((o) => o.value === opt.value) === i);

export const BUDGET_PURCHASE_TYPES = [
  { value: "RENTAL", label: "Rental / hire" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "LABOR", label: "Labor & fees" },
  { value: "LOCATION", label: "Location fee" },
  { value: "PERMIT", label: "Permit / license" },
  { value: "CATERING", label: "Catering" },
  { value: "TRAVEL", label: "Travel & transport" },
  { value: "SERVICE", label: "Professional service" },
  { value: "ALLOWANCE", label: "Allowance / per diem" },
  { value: "OTHER", label: "Other" },
] as const;

export type BudgetPurchaseType = (typeof BUDGET_PURCHASE_TYPES)[number]["value"];

export const BUDGET_UNIT_TYPES = [
  { value: "DAY", label: "Per day", qtyLabel: "Days" },
  { value: "WEEK", label: "Per week", qtyLabel: "Weeks" },
  { value: "HOUR", label: "Per hour", qtyLabel: "Hours" },
  { value: "EACH", label: "Per unit", qtyLabel: "Qty" },
  { value: "FLAT", label: "Flat fee", qtyLabel: "Qty" },
  { value: "KM", label: "Per km", qtyLabel: "Km" },
] as const;

export type BudgetUnitType = (typeof BUDGET_UNIT_TYPES)[number]["value"];

const UNIT_PREFIX = "::unit:";
const UNIT_SUFFIX = "::";

export function encodeUnitTypeInNotes(notes: string, unitType: BudgetUnitType): string {
  const stripped = stripUnitTypeFromNotes(notes);
  const unit = BUDGET_UNIT_TYPES.find((u) => u.value === unitType);
  const prefix = `${UNIT_PREFIX}${unitType}${UNIT_SUFFIX}`;
  if (unitType === "FLAT") return stripped;
  return stripped ? `${prefix}${stripped}` : prefix;
}

export function stripUnitTypeFromNotes(notes: string): string {
  const match = notes.match(/^::unit:[A-Z_]+::/);
  return match ? notes.slice(match[0].length) : notes;
}

export function readUnitTypeFromNotes(notes: string): BudgetUnitType {
  const match = notes.match(/^::unit:([A-Z_]+)::/);
  const found = match?.[1] as BudgetUnitType | undefined;
  if (found && BUDGET_UNIT_TYPES.some((u) => u.value === found)) return found;
  return "EACH";
}

export function purchaseTypeLabel(value: string): string {
  return BUDGET_PURCHASE_TYPES.find((t) => t.value === value)?.label ?? friendlyDepartmentName(value);
}

const ENGINE_CATEGORY_LABELS: Record<string, string> = {
  CHARACTER: "Cast (from script)",
  PROP: "Prop (from breakdown)",
  LOCATION: "Location (from breakdown)",
  WARDROBE: "Wardrobe (from breakdown)",
  EXTRAS: "Extras (from breakdown)",
  VEHICLE: "Vehicle (from breakdown)",
  STUNT: "Stunt (from breakdown)",
  SFX: "SFX (from breakdown)",
  MAKEUP: "Makeup (from breakdown)",
  ENGINE: "Script estimate",
  MANUAL: "Manual entry",
};

export function lineCategoryLabel(category: string, isEngineRow: boolean): string {
  if (!isEngineRow) return purchaseTypeLabel(category);
  return ENGINE_CATEGORY_LABELS[category.toUpperCase()] ?? category.replaceAll("_", " ");
}

export function isEngineBudgetRow(category: string): boolean {
  const c = category.toUpperCase();
  return (
    c === "ENGINE" ||
    c === "CHARACTER" ||
    c === "PROP" ||
    c === "LOCATION" ||
    c === "WARDROBE" ||
    c === "EXTRAS" ||
    c === "VEHICLE" ||
    c === "STUNT" ||
    c === "SFX" ||
    c === "MAKEUP"
  );
}

export const DEFAULT_NEW_LINE = {
  department: "CREW",
  category: "LABOR" as BudgetPurchaseType,
  name: "",
  quantity: 1,
  unitCost: 0,
  notes: "",
  unitType: "DAY" as BudgetUnitType,
  sceneId: null as string | null,
};
