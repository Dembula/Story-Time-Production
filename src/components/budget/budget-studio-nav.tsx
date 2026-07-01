"use client";

export type BudgetWorkspaceId = "overview" | "line-items" | "actuals";

const WORKSPACES: { id: BudgetWorkspaceId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "line-items", label: "Budget lines" },
  { id: "actuals", label: "Spending" },
];

type BudgetStudioNavProps = {
  active: BudgetWorkspaceId;
  onChange: (id: BudgetWorkspaceId) => void;
};

export function BudgetStudioNav({ active, onChange }: BudgetStudioNavProps) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      aria-label="Budget sections"
    >
      {WORKSPACES.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onChange(w.id)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
            active === w.id
              ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
              : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          {w.label}
        </button>
      ))}
    </nav>
  );
}

const DEPARTMENT_LABELS: Record<string, string> = {
  CAST: "Cast",
  CREW: "Crew",
  EQUIPMENT: "Equipment",
  LOCATIONS: "Locations",
  ART_DEPARTMENT: "Art & set",
  WARDROBE_MAKEUP: "Wardrobe & makeup",
  SOUND: "Sound",
  TRANSPORT_LOGISTICS: "Transport",
  CATERING: "Catering",
  POST_PRODUCTION: "Post-production",
  CONTINGENCY: "Contingency",
  INSURANCE: "Insurance",
  PERMITS: "Permits",
  TAXES: "Taxes",
  MANUAL: "Other",
  PROPS: "Props",
  WARDROBE: "Wardrobe",
  CASTING: "Casting",
  STUNTS: "Stunts",
  SFX: "Special effects",
  HAIR_MAKEUP: "Hair & makeup",
  TRANSPORT: "Transport",
};

export function friendlyDepartmentName(department: string): string {
  const key = department.trim().toUpperCase();
  if (DEPARTMENT_LABELS[key]) return DEPARTMENT_LABELS[key];
  return department
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
