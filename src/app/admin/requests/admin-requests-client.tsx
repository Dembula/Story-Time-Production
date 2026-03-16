"use client";

import { useEffect, useState } from "react";
import { Shield, CheckCircle, XCircle, Loader2, UserPlus } from "lucide-react";

type AdminRequestRow = {
  id: string;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  assignedRights: Record<string, boolean> | null;
  note: string | null;
  requestedBy: { id: string; name: string | null; email: string | null; role: string };
  reviewedBy: { id: string; name: string | null; email: string | null } | null;
};

const RIGHTS_OPTIONS = [
  { key: "canManageUsers", label: "Manage users" },
  { key: "canManageContent", label: "Manage content" },
  { key: "canManageRevenue", label: "Manage revenue" },
  { key: "canManageCompetition", label: "Manage competition" },
];

export function AdminRequestsClient() {
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "all">("PENDING");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState<Record<string, string>>({});
  const [selectedRights, setSelectedRights] = useState<Record<string, Record<string, boolean>>>({});

  function load() {
    setLoading(true);
    fetch(`/api/admin/requests?status=${filter}`)
      .then((r) => r.json())
      .then(setRequests)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function handleAction(id: string, action: "APPROVE" | "DENY") {
    setActionLoading(id);
    const body: { id: string; action: string; assignedRights?: Record<string, boolean>; note?: string } = {
      id,
      action,
    };
    if (action === "APPROVE") body.assignedRights = selectedRights[id] ?? undefined;
    if (action === "DENY") body.note = denyNote[id] ?? undefined;
    try {
      const res = await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } finally {
      setActionLoading(null);
    }
  }

  function toggleRight(reqId: string, key: string) {
    setSelectedRights((prev) => ({
      ...prev,
      [reqId]: {
        ...(prev[reqId] ?? {}),
        [key]: !prev[reqId]?.[key],
      },
    }));
  }

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-orange-500" /> Admin requests
        </h1>
        <p className="text-slate-400">Review and approve or deny requests for admin access.</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("PENDING")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === "PENDING"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white"
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === "all"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white"
          }`}
        >
          All
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
          <UserPlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No admin requests found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">
                    {req.requestedBy.name || req.requestedBy.email}
                  </p>
                  <p className="text-sm text-slate-400">{req.requestedBy.email}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Requested {new Date(req.requestedAt).toLocaleString()} · Current role: {req.requestedBy.role}
                  </p>
                  {req.status !== "PENDING" && req.reviewedBy && (
                    <p className="text-xs text-slate-500 mt-1">
                      {req.status} by {req.reviewedBy.name || req.reviewedBy.email}
                      {req.reviewedAt && ` at ${new Date(req.reviewedAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      req.status === "PENDING"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : req.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>

              {req.status === "PENDING" && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Assign rights (optional)</p>
                    <div className="flex flex-wrap gap-3">
                      {RIGHTS_OPTIONS.map((r) => (
                        <label key={r.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRights[req.id]?.[r.key] ?? false}
                            onChange={() => toggleRight(req.id, r.key)}
                            className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-sm text-slate-300">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Denial note (if denying)
                    </label>
                    <input
                      type="text"
                      value={denyNote[req.id] ?? ""}
                      onChange={(e) =>
                        setDenyNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      placeholder="Optional reason"
                      className="w-full max-w-md px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-600 text-white text-sm placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req.id, "APPROVE")}
                      disabled={actionLoading === req.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 text-sm font-medium"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "DENY")}
                      disabled={actionLoading === req.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 text-sm font-medium"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Deny
                    </button>
                  </div>
                </div>
              )}

              {req.note && req.status === "DENIED" && (
                <p className="mt-2 text-sm text-slate-500">Note: {req.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
