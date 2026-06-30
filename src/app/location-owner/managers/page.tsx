"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { OpsPageHeader } from "@/components/ecosystem/ops-shell";

export default function LocationManagersAdminPage() {
  const qc = useQueryClient();
  const [listingId, setListingId] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["location-managers"],
    queryFn: () => fetch("/api/location-owner/managers").then((r) => r.json()),
  });

  const assignMut = useMutation({
    mutationFn: () =>
      fetch("/api/location-owner/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, managerEmail: managerEmail.trim(), canApproveBookings: true }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not assign manager");
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["location-managers"] });
      setManagerEmail("");
      setMessage("Manager assigned.");
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const removeMut = useMutation({
    mutationFn: ({ listingId: lid, managerUserId }: { listingId: string; managerUserId: string }) =>
      fetch(`/api/location-owner/managers?listingId=${lid}&managerUserId=${managerUserId}`, { method: "DELETE" }).then(
        async (r) => {
          if (!r.ok) {
            const json = await r.json();
            throw new Error(json.error ?? "Could not remove manager");
          }
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["location-managers"] });
      setMessage("Manager removed.");
    },
    onError: (e: Error) => setMessage(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader
        title="Site managers"
        subtitle="Assign on-site managers by email — they need a Story Time account with the email you enter."
      />
      <Link href="/location-owner/manager" className="text-xs text-orange-400 hover:text-orange-300">
        Preview manager view →
      </Link>
      {message && <p className="text-xs text-slate-400">{message}</p>}
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="rounded-xl border border-slate-800 p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Assign manager</h3>
        <select value={listingId} onChange={(e) => setListingId(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm">
          <option value="">Select property…</option>
          {(data?.owned ?? []).map((l: { id: string; name: string }) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <input
          value={managerEmail}
          onChange={(e) => setManagerEmail(e.target.value)}
          placeholder="Manager email address"
          type="email"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!listingId || !managerEmail.trim() || assignMut.isPending}
          onClick={() => assignMut.mutate()}
          className="rounded bg-orange-500 px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          Assign manager
        </button>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white">Current assignments</h3>
        {(data?.assignments ?? []).length === 0 && <p className="text-sm text-slate-500">No managers assigned yet.</p>}
        {(data?.assignments ?? []).map((m: { id: string; listingId: string; userId: string; role: string; canApproveBookings: boolean; listing: { name: string }; user: { name: string | null; email: string | null } }) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-3 py-2 text-xs">
            <span className="text-slate-200">{m.listing.name} · {m.user.name ?? m.user.email}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{m.role}{m.canApproveBookings ? " · can approve" : ""}</span>
              <button
                type="button"
                className="text-rose-400 hover:text-rose-300"
                onClick={() => removeMut.mutate({ listingId: m.listingId, managerUserId: m.userId })}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
