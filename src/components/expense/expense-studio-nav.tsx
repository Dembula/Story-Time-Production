"use client";

export type ExpenseWorkspaceId =
  | "dashboard"
  | "expenses"
  | "departments"
  | "budget-compare"
  | "entry"
  | "receipts"
  | "reports"
  | "vendors"
  | "purchase-orders"
  | "payroll"
  | "analytics"
  | "budget-versions"
  | "petty-cash"
  | "bank-import";

const WORKSPACES: { id: ExpenseWorkspaceId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "budget-compare", label: "Budget vs actual" },
  { id: "budget-versions", label: "Budget versions" },
  { id: "departments", label: "Departments" },
  { id: "vendors", label: "Vendors" },
  { id: "purchase-orders", label: "Purchase orders" },
  { id: "payroll", label: "Payroll" },
  { id: "petty-cash", label: "Petty cash" },
  { id: "bank-import", label: "Bank import" },
  { id: "entry", label: "New expense" },
  { id: "expenses", label: "All expenses" },
  { id: "receipts", label: "Receipts" },
  { id: "reports", label: "Reports" },
];

type ExpenseStudioNavProps = {
  active: ExpenseWorkspaceId;
  onChange: (id: ExpenseWorkspaceId) => void;
};

export function ExpenseStudioNav({ active, onChange }: ExpenseStudioNavProps) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="Expense workspaces">
      {WORKSPACES.map((w) => (
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
    </nav>
  );
}
