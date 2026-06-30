"use client";

import type { DepartmentWorkspacePayload } from "@/lib/breakdown/department-workspace";

function poStatusColor(status: string | null) {
  if (!status) return "bg-slate-800 text-slate-400";
  const s = status.toUpperCase();
  if (["APPROVED", "SENT", "CLOSED"].includes(s)) return "bg-emerald-500/15 text-emerald-300";
  if (["DRAFT", "PENDING"].includes(s)) return "bg-amber-500/15 text-amber-200";
  return "bg-slate-800 text-slate-300";
}

export function BreakdownDepartmentWorkspacePanel({
  workspace,
  loading,
}: {
  workspace: DepartmentWorkspacePayload | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">
        Loading department workspace…
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
        Select a department above to view assets, purchase orders, and equipment.
      </p>
    );
  }

  const { stats } = workspace;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${workspace.color}33`, color: workspace.color }}
        >
          {workspace.label} workspace
        </span>
        <span className="text-[11px] text-slate-500">
          {stats.assetCount} assets · {stats.openPoCount} open POs · {stats.equipmentCount} equipment lines
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[10px] uppercase text-slate-500">Assets</p>
          <p className="text-xl font-semibold text-white">{stats.assetCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[10px] uppercase text-slate-500">Open POs</p>
          <p className="text-xl font-semibold text-amber-200">{stats.openPoCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[10px] uppercase text-slate-500">Approved POs</p>
          <p className="text-xl font-semibold text-emerald-300">{stats.approvedPoCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[10px] uppercase text-slate-500">Equipment</p>
          <p className="text-xl font-semibold text-white">{stats.equipmentCount}</p>
        </div>
      </div>

      {workspace.assets.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] uppercase text-slate-500">
            Breakdown assets
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Scenes</th>
                  <th className="px-3 py-2">PO</th>
                  <th className="px-3 py-2">Rental</th>
                </tr>
              </thead>
              <tbody>
                {workspace.assets.map((a) => (
                  <tr key={`${a.category}-${a.id}`} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{a.label}</td>
                    <td className="px-3 py-2 text-slate-400">{a.sceneNumbers.join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      {a.poStatus ? (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] ${poStatusColor(a.poStatus)}`}>
                          {a.poNumber ?? a.poStatus}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{a.rentalStatus ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">No breakdown assets tagged for this department yet.</p>
      )}

      {workspace.purchaseOrders.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] uppercase text-slate-500">
            Purchase orders
          </div>
          <ul className="max-h-48 divide-y divide-slate-800 overflow-y-auto text-xs">
            {workspace.purchaseOrders.map((po) => (
              <li key={po.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-200">{po.poNumber}</p>
                  <p className="text-[10px] text-slate-500">{po.vendorName ?? "No vendor"}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] ${poStatusColor(po.status)}`}>{po.status}</span>
                  <p className="mt-1 text-[10px] text-slate-400">${po.total.toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {workspace.equipmentItems.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] uppercase text-slate-500">
            Equipment plan
          </div>
          <ul className="max-h-40 divide-y divide-slate-800 overflow-y-auto text-xs">
            {workspace.equipmentItems.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-200">{e.description}</span>
                <span className="text-slate-500">
                  ×{e.quantity}
                  {e.listingLinked ? " · linked" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
