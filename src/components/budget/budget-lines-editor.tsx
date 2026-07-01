"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatZar } from "@/lib/format-currency-zar";
import { friendlyDepartmentName } from "@/components/budget/budget-studio-nav";
import {
  BUDGET_DEPARTMENT_OPTIONS,
  BUDGET_PURCHASE_TYPES,
  BUDGET_UNIT_TYPES,
  DEFAULT_NEW_LINE,
  encodeUnitTypeInNotes,
  isEngineBudgetRow,
  lineCategoryLabel,
  readUnitTypeFromNotes,
  stripUnitTypeFromNotes,
  type BudgetPurchaseType,
  type BudgetUnitType,
} from "@/lib/budget-line-meta";

export type BudgetLineRow = {
  id?: string;
  key: string;
  department: string;
  name: string;
  quantity: number;
  unitCost: number;
  total: number;
  notes: string;
  sceneId: string | null;
  sceneNumber: string | null;
  sceneHeading: string | null;
  category: string;
};

type BudgetLinesEditorProps = {
  rows: BudgetLineRow[];
  scenes?: Array<{ id: string; number: string; heading: string | null }>;
  onUpdateLine: (index: number, field: keyof BudgetLineRow, value: string | number) => void;
  onRemoveLine: (index: number) => void;
  onAddLine: (line: Omit<BudgetLineRow, "key" | "total">) => void;
};

function selectClassName(compact?: boolean) {
  return `rounded-md border border-slate-700 bg-slate-950 text-white ${
    compact ? "h-8 px-2 text-[11px]" : "h-9 px-2 text-xs"
  }`;
}

export function BudgetLinesEditor({
  rows,
  scenes = [],
  onUpdateLine,
  onRemoveLine,
  onAddLine,
}: BudgetLinesEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState({ ...DEFAULT_NEW_LINE });

  const grouped = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.name.localeCompare(b.name),
    );
    const groups = new Map<string, BudgetLineRow[]>();
    for (const row of sorted) {
      const list = groups.get(row.department) ?? [];
      list.push(row);
      groups.set(row.department, list);
    }
    return [...groups.entries()].sort(([a], [b]) =>
      friendlyDepartmentName(a).localeCompare(friendlyDepartmentName(b)),
    );
  }, [rows]);

  const submitNewLine = () => {
    if (!draft.name.trim()) return;
    const scene = draft.sceneId ? scenes.find((s) => s.id === draft.sceneId) : null;
    onAddLine({
      id: undefined,
      department: draft.department,
      category: draft.category,
      name: draft.name.trim(),
      quantity: draft.quantity,
      unitCost: draft.unitCost,
      notes: encodeUnitTypeInNotes(draft.notes.trim(), draft.unitType),
      sceneId: draft.sceneId,
      sceneNumber: scene?.number ?? null,
      sceneHeading: scene?.heading ?? null,
    });
    setDraft({ ...DEFAULT_NEW_LINE });
    setShowAddForm(false);
  };

  const unitQtyLabel =
    BUDGET_UNIT_TYPES.find((u) => u.value === draft.unitType)?.qtyLabel ?? "Qty";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-orange-200 hover:bg-slate-800/50 transition"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="font-medium">Add budget line</span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              — pick department, what you&apos;re buying, quantity and rate
            </span>
          </button>
        ) : (
          <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-950/50">
            <p className="text-xs font-medium text-slate-200">New budget line</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Department</span>
                <select
                  value={draft.department}
                  onChange={(e) => setDraft((p) => ({ ...p, department: e.target.value }))}
                  className={`w-full ${selectClassName()}`}
                >
                  {BUDGET_DEPARTMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Type of cost</span>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, category: e.target.value as BudgetPurchaseType }))
                  }
                  className={`w-full ${selectClassName()}`}
                >
                  {BUDGET_PURCHASE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">What you&apos;re buying</span>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Camera package rental, Location scout fee, Lead actor day rate"
                  className="h-9 bg-slate-950 border-slate-700 text-xs"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Rate basis</span>
                <select
                  value={draft.unitType}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, unitType: e.target.value as BudgetUnitType }))
                  }
                  className={`w-full ${selectClassName()}`}
                >
                  {BUDGET_UNIT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{unitQtyLabel}</span>
                <Input
                  type="number"
                  min={0}
                  step={draft.unitType === "FLAT" ? 1 : 0.5}
                  value={draft.unitType === "FLAT" ? 1 : draft.quantity}
                  disabled={draft.unitType === "FLAT"}
                  onChange={(e) => setDraft((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))}
                  className="h-9 bg-slate-950 border-slate-700 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Rate (R)</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.unitCost}
                  onChange={(e) => setDraft((p) => ({ ...p, unitCost: Number(e.target.value) || 0 }))}
                  className="h-9 bg-slate-950 border-slate-700 text-xs"
                />
              </label>
              {scenes.length > 0 ? (
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">Scene (optional)</span>
                  <select
                    value={draft.sceneId ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, sceneId: e.target.value || null }))}
                    className={`w-full ${selectClassName()}`}
                  >
                    <option value="">All scenes / production-wide</option>
                    {scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        Scene {s.number}
                        {s.heading ? ` — ${s.heading}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1 sm:col-span-2 lg:col-span-5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Vendor / notes (optional)</span>
                <Input
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Supplier name, quote ref, or extra detail"
                  className="h-9 bg-slate-950 border-slate-700 text-xs"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-slate-400">
                Line total:{" "}
                <span className="text-emerald-300 font-medium">
                  {formatZar(
                    (draft.unitType === "FLAT" ? 1 : draft.quantity) * Math.max(0, draft.unitCost),
                  )}
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-slate-400"
                  onClick={() => {
                    setShowAddForm(false);
                    setDraft({ ...DEFAULT_NEW_LINE });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!draft.name.trim()}
                  onClick={submitNewLine}
                >
                  Add to budget
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center rounded-xl border border-dashed border-slate-800">
          No budget lines yet. Use &quot;Add budget line&quot; above to start building your production budget.
        </p>
      ) : (
        <div className="creator-glass-panel overflow-hidden">
          <div className="max-h-[min(62vh,560px)] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2.5 text-left font-medium text-[10px] uppercase tracking-wide w-[140px]">
                    Department
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-[10px] uppercase tracking-wide w-[120px]">
                    Cost type
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-[10px] uppercase tracking-wide">
                    Item / description
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-[10px] uppercase tracking-wide w-16">
                    Qty
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-[10px] uppercase tracking-wide w-24">
                    Rate
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-[10px] uppercase tracking-wide w-24">
                    Total
                  </th>
                  <th className="px-3 py-2.5 w-14" />
                </tr>
              </thead>
              <tbody>
                {grouped.map(([department, deptRows]) => {
                  const deptSubtotal = deptRows.reduce((sum, r) => {
                    const idx = rows.findIndex((row) => row.key === r.key);
                    return sum + (idx >= 0 ? rows[idx].total : r.total);
                  }, 0);
                  return (
                    <Fragment key={`dept-${department}`}>
                      <tr className="bg-slate-800/40">
                        <td colSpan={5} className="px-3 py-2 text-[11px] font-semibold text-slate-200">
                          {friendlyDepartmentName(department)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] font-medium text-emerald-300/90">
                          {formatZar(deptSubtotal, { maximumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                      {deptRows.map((line) => {
                        const idx = rows.findIndex((r) => r.key === line.key);
                        if (idx < 0) return null;
                        const row = rows[idx];
                        const engineRow = isEngineBudgetRow(row.category);
                        const unitType = readUnitTypeFromNotes(row.notes);
                        const displayNotes = stripUnitTypeFromNotes(row.notes);
                        const qtyLabel =
                          BUDGET_UNIT_TYPES.find((u) => u.value === unitType)?.qtyLabel ?? "Qty";

                        return (
                          <tr key={line.key} className="border-t border-slate-800/80 hover:bg-slate-900/30">
                            <td className="px-3 py-2 align-top">
                              <select
                                value={row.department}
                                onChange={(e) => onUpdateLine(idx, "department", e.target.value)}
                                className={`w-full max-w-[140px] ${selectClassName(true)}`}
                              >
                                {BUDGET_DEPARTMENT_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {engineRow ? (
                                <span className="inline-block rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-400">
                                  {lineCategoryLabel(row.category, true)}
                                </span>
                              ) : (
                                <select
                                  value={row.category}
                                  onChange={(e) => onUpdateLine(idx, "category", e.target.value)}
                                  className={`w-full max-w-[120px] ${selectClassName(true)}`}
                                >
                                  {BUDGET_PURCHASE_TYPES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top space-y-1.5 min-w-[200px]">
                              <Input
                                value={row.name}
                                onChange={(e) => onUpdateLine(idx, "name", e.target.value)}
                                className="h-8 bg-slate-950 border-slate-800 text-[11px]"
                                placeholder="What you're paying for"
                              />
                              {row.sceneNumber ? (
                                <p className="text-[10px] text-slate-500">
                                  Scene {row.sceneNumber}
                                  {row.sceneHeading ? ` · ${row.sceneHeading}` : ""}
                                </p>
                              ) : null}
                              <Input
                                value={displayNotes}
                                onChange={(e) =>
                                  onUpdateLine(
                                    idx,
                                    "notes",
                                    encodeUnitTypeInNotes(e.target.value, unitType),
                                  )
                                }
                                className="h-7 bg-slate-950/80 border-slate-800 text-[10px] text-slate-400"
                                placeholder="Vendor or notes"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="text-right">
                                <span className="text-[9px] text-slate-600 block mb-0.5">{qtyLabel}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.quantity}
                                  onChange={(e) =>
                                    onUpdateLine(idx, "quantity", Number(e.target.value) || 0)
                                  }
                                  className="h-8 bg-slate-950 border-slate-800 text-[11px] text-right w-16 ml-auto"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Input
                                type="number"
                                min={0}
                                value={row.unitCost}
                                onChange={(e) =>
                                  onUpdateLine(idx, "unitCost", Number(e.target.value) || 0)
                                }
                                className="h-8 bg-slate-950 border-slate-800 text-[11px] text-right w-24 ml-auto"
                              />
                            </td>
                            <td className="px-3 py-2 align-top text-right text-slate-100 font-medium pt-3">
                              {formatZar(row.total)}
                            </td>
                            <td className="px-3 py-2 align-top text-right pt-3">
                              <button
                                type="button"
                                className="text-[10px] font-medium text-red-400 hover:text-red-300"
                                onClick={() => onRemoveLine(idx)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
