"use client";

import { useState } from "react";

type EscrowRow = {
  id: string;
  referenceType: string;
  referenceId: string;
  status: string;
  amount: number;
  buyerUserId?: string;
  sellerUserId?: string;
};

export function EscrowActions({
  escrow,
  currentUserId,
  isAdmin,
  onUpdated,
}: {
  escrow: EscrowRow;
  currentUserId: string;
  isAdmin?: boolean;
  onUpdated?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBuyer = escrow.buyerUserId === currentUserId;
  const canRelease = escrow.status === "HELD" && (isBuyer || isAdmin);
  const canDispute = escrow.status === "HELD" && (isBuyer || escrow.sellerUserId === currentUserId || isAdmin);
  const canAdminResolve = isAdmin && escrow.status === "DISPUTED";

  async function post(path: string, body: Record<string, string>) {
    setBusy(path);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  if (!canRelease && !canDispute && !canAdminResolve) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {canRelease ? (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => post("/api/payments/escrow/release", { escrowId: escrow.id })}
          className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Confirm delivery
        </button>
      ) : null}
      {canDispute ? (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => post("/api/payments/escrow/dispute", { escrowId: escrow.id })}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
        >
          Open dispute
        </button>
      ) : null}
      {canAdminResolve ? (
        <>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              post("/api/admin/payments/escrow/resolve", {
                escrowId: escrow.id,
                resolution: "release",
              })
            }
            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
          >
            Admin: release
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              post("/api/admin/payments/escrow/resolve", {
                escrowId: escrow.id,
                resolution: "refund",
              })
            }
            className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
          >
            Admin: refund buyer
          </button>
        </>
      ) : null}
      {error ? <p className="w-full text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
