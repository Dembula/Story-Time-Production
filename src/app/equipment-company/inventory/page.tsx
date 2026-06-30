"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OpsPageHeader } from "@/components/ecosystem/ops-shell";

export default function EquipmentInventoryPage() {
  const qc = useQueryClient();
  const [rfidTag, setRfidTag] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [scanTag, setScanTag] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["equipment-inventory"],
    queryFn: () => fetch("/api/equipment-company/inventory").then((r) => r.json()),
  });

  const registerMut = useMutation({
    mutationFn: () =>
      fetch("/api/equipment-company/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId, rfidTag }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment-inventory"] });
      setRfidTag("");
    },
  });

  const scanMut = useMutation({
    mutationFn: () =>
      fetch("/api/equipment-company/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", rfidTag: scanTag, location: "Warehouse" }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["equipment-inventory"] }),
  });

  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader title="RFID inventory" subtitle="Register asset tags, track scans, and monitor fleet availability." />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Total tags", summary.total],
            ["Available", summary.byStatus?.AVAILABLE ?? 0],
            ["Rented", summary.byStatus?.RENTED ?? 0],
            ["Maintenance", summary.byStatus?.MAINTENANCE ?? 0],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-semibold text-white">{String(val)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Register tag</h3>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm">
            <option value="">Select kit…</option>
            {(data?.listings ?? []).map((l: { id: string; companyName: string }) => (
              <option key={l.id} value={l.id}>{l.companyName}</option>
            ))}
          </select>
          <input value={rfidTag} onChange={(e) => setRfidTag(e.target.value)} placeholder="RFID tag ID" className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
          <button type="button" disabled={!equipmentId || !rfidTag} onClick={() => registerMut.mutate()} className="rounded bg-orange-500 px-3 py-2 text-xs text-white disabled:opacity-50">
            Register
          </button>
        </div>
        <div className="rounded-xl border border-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Scan tag</h3>
          <input value={scanTag} onChange={(e) => setScanTag(e.target.value)} placeholder="Scan or enter RFID" className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
          <button type="button" disabled={!scanTag} onClick={() => scanMut.mutate()} className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-200">
            Record scan
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-2">
        {(data?.tags ?? []).map((t: { id: string; rfidTag: string; status: string; equipment: { companyName: string }; lastScanAt: string | null }) => (
          <div key={t.id} className="flex justify-between rounded border border-slate-800 px-3 py-2 text-xs">
            <span className="text-slate-200">{t.equipment.companyName} · {t.rfidTag}</span>
            <span className="text-slate-500">{t.status}{t.lastScanAt ? ` · scanned ${new Date(t.lastScanAt).toLocaleDateString()}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
