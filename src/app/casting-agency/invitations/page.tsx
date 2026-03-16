"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, UserX } from "lucide-react";

type CastingInvitationView = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  role: { id: string; name: string; projectId: string };
  project: { id: string; title: string | null };
  talent: { id: string; name: string } | null;
  creator: { id: string; name: string | null };
};

export default function CastingAgencyInvitationsPage() {
  const [invitations, setInvitations] = useState<CastingInvitationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/casting-agency/invitations")
      .then((r) => r.json())
      .then((arr) => {
        setInvitations(Array.isArray(arr) ? arr : []);
        setLoading(false);
      });
  }, []);

  async function updateStatus(id: string, status: "ACCEPTED" | "DECLINED") {
    setUpdatingId(id);
    const res = await fetch("/api/casting-agency/invitations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInvitations((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: updated.status } : inv)));
    }
    setUpdatingId(null);
  }

  if (loading)
    return (
      <div className="flex justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Casting invitations</h1>
        <p className="text-xs text-slate-400">Respond to offers from Story Time creators.</p>
      </div>

      {invitations.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-10 text-center text-slate-500 text-sm">
          No invitations yet. Creators can invite your talent directly from the casting portal.
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((inv) => (
            <div key={inv.id} className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-0.5">Project</p>
                  <p className="font-medium text-white">
                    {inv.project?.title ?? "Untitled"}{" "}
                    <span className="text-xs text-slate-500 ml-1">({inv.role.name})</span>
                  </p>
                  {inv.talent && (
                    <p className="text-xs text-violet-300 mt-1">
                      Talent: <span className="font-medium">{inv.talent.name}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    From {inv.creator?.name || "Creator"} · {new Date(inv.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    "px-3 py-1 rounded-full text-xs font-medium " +
                    (inv.status === "PENDING"
                      ? "bg-amber-500/15 text-amber-300"
                      : inv.status === "ACCEPTED"
                      ? "bg-green-500/15 text-green-300"
                      : "bg-slate-600/40 text-slate-200")
                  }
                >
                  {inv.status}
                </span>
              </div>
              {inv.message && <p className="text-xs text-slate-300 mt-1">{inv.message}</p>}
              {inv.status === "PENDING" && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => updateStatus(inv.id, "ACCEPTED")}
                    disabled={updatingId === inv.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <UserCheck className="w-3 h-3" /> Accept
                  </button>
                  <button
                    onClick={() => updateStatus(inv.id, "DECLINED")}
                    disabled={updatingId === inv.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-100 text-xs font-medium hover:bg-slate-600 disabled:opacity-60"
                  >
                    <UserX className="w-3 h-3" /> Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

