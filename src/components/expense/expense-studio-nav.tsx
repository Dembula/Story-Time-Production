"use client";

export type ExpenseWorkspaceId =
  | "dashboard"
  | "entry"
  | "expenses"
  | "budget-compare"
  | "reports"
  | "vendors"
  | "purchase-orders"
  | "payroll"
  | "petty-cash";

const PRIMARY_WORKSPACES: { id: ExpenseWorkspaceId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "entry", label: "Upload receipt" },
  { id: "expenses", label: "All expenses" },
  { id: "budget-compare", label: "Budget vs actual" },
];

const MORE_WORKSPACES: { id: ExpenseWorkspaceId; label: string }[] = [
  { id: "reports", label: "Reports" },
  { id: "vendors", label: "Vendors" },
  { id: "purchase-orders", label: "Purchase orders" },
  { id: "payroll", label: "Payroll" },
  { id: "petty-cash", label: "Petty cash" },
];

type ExpenseStudioNavProps = {
  active: ExpenseWorkspaceId;
  onChange: (id: ExpenseWorkspaceId) => void;
};

export function ExpenseStudioNav({ active, onChange }: ExpenseStudioNavProps) {
  return (
    <nav className="space-y-2" aria-label="Expense sections">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PRIMARY_WORKSPACES.map((w) => (
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-600">More</span>
        {MORE_WORKSPACES.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onChange(w.id)}
            className={`shrink-0 rounded-md px-2 py-1 text-[10px] transition ${
              active === w.id
                ? "bg-slate-800 text-orange-200 ring-1 ring-orange-500/30"
                : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
