"use client";

export type BudgetWorkspaceId =
  | "dashboard"
  | "scenes"
  | "above-line"
  | "below-line"
  | "departments"
  | "cast"
  | "crew"
  | "equipment"
  | "locations"
  | "logistics"
  | "post"
  | "contingency"
  | "cash-flow"
  | "actuals"
  | "reports"
  | "versions";

const WORKSPACES: { id: BudgetWorkspaceId; label: string; group: string }[] = [
  { id: "dashboard", label: "Dashboard", group: "Overview" },
  { id: "scenes", label: "Scene budgets", group: "Overview" },
  { id: "above-line", label: "Above the line", group: "Structure" },
  { id: "below-line", label: "Below the line", group: "Structure" },
  { id: "departments", label: "Departments", group: "Structure" },
  { id: "cast", label: "Cast", group: "Production" },
  { id: "crew", label: "Crew", group: "Production" },
  { id: "equipment", label: "Equipment", group: "Production" },
  { id: "locations", label: "Locations", group: "Production" },
  { id: "logistics", label: "Transport & catering", group: "Production" },
  { id: "post", label: "Post production", group: "Finishing" },
  { id: "contingency", label: "Contingency & tax", group: "Finishing" },
  { id: "cash-flow", label: "Cash flow", group: "Finance" },
  { id: "actuals", label: "Actuals", group: "Finance" },
  { id: "versions", label: "Versions", group: "Finance" },
  { id: "reports", label: "Reports", group: "Finance" },
];

type BudgetStudioNavProps = {
  active: BudgetWorkspaceId;
  onChange: (id: BudgetWorkspaceId) => void;
};

export function BudgetStudioNav({ active, onChange }: BudgetStudioNavProps) {
  const groups = [...new Set(WORKSPACES.map((w) => w.group))];
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      aria-label="Budget workspaces"
    >
      {groups.map((group) => (
        <div key={group} className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-[9px] font-medium uppercase tracking-wider text-slate-600 sm:inline">
            {group}
          </span>
          {WORKSPACES.filter((w) => w.group === group).map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onChange(w.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                active === w.id
                  ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
                  : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function budgetWorkspaceDepartments(id: BudgetWorkspaceId): string[] | null {
  switch (id) {
    case "above-line":
      return ["CAST", "PRODUCER", "DIRECTOR", "WRITER"];
    case "below-line":
      return [
        "CREW",
        "EQUIPMENT",
        "LOCATIONS",
        "ART_DEPARTMENT",
        "WARDROBE_MAKEUP",
        "SOUND",
        "TRANSPORT_LOGISTICS",
        "CATERING",
      ];
    case "cast":
      return ["CAST"];
    case "crew":
      return ["CREW"];
    case "equipment":
      return ["EQUIPMENT"];
    case "locations":
      return ["LOCATIONS"];
    case "logistics":
      return ["TRANSPORT_LOGISTICS", "CATERING"];
    case "post":
      return ["POST_PRODUCTION"];
    case "contingency":
      return ["CONTINGENCY", "INSURANCE", "PERMITS", "TAXES"];
    default:
      return null;
  }
}
