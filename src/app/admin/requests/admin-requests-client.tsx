"use client";

import { useEffect, useState } from "react";
import { Shield, CheckCircle, XCircle, Loader2, UserPlus, Mail } from "lucide-react";

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

type AccessApplicationRow = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  note: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string | null; email: string | null } | null;
};

const RIGHTS_OPTIONS = [
  { key: "canManageUsers", label: "Manage users" },
  { key: "canManageContent", label: "Manage content" },
  { key: "canManageRevenue", label: "Manage revenue" },
  { key: "canManageCompetition", label: "Manage competition" },
];

type Tab = "applications" | "role_upgrades";

export function AdminRequestsClient() {
  const [tab, setTab] = useState<Tab>("applications");
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [applications, setApplications] = useState<AccessApplicationRow[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "all">("PENDING");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState<Record<string, string>>({});
  const [selectedRights, setSelectedRights] = useState<Record<string, Record<string, boolean>>>({});

  function loadRoleUpgrades() {
    return fetch(`/api/admin/requests?status=${filter}`)
      .then((r) => r.json())
      .then(setRequests);
  }

  function loadApplications() {
    return fetch("/api/admin/access-applications")
      .then((r) => r.json())
      .then(setApplications);
  }

  useEffect(() => {
    setReqLoading(true);
    void loadRoleUpgrades().finally(() => setReqLoading(false));
  }, [filter]);

  useEffect(() => {
    setAppsLoading(true);
    void loadApplications().finally(() => setAppsLoading(false));
  }, [tab]);

  async function handleRequestAction(id: string, action: "APPROVE" | "DENY") {
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
        const updated = (await res.json()) as AdminRequestRow;
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApplicationAction(id: string, action: "APPROVE" | "DENY") {
    setActionLoading(id);
    const body: { id: string; action: string; assignedRights?: Record<string, boolean>; note?: string } = {
      id,
      action,
    };
    if (action === "APPROVE") body.assignedRights = selectedRights[id] ?? undefined;
    if (action === "DENY") body.note = denyNote[id] ?? undefined;
    try {
      const res = await fetch("/api/admin/access-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = (await res.json()) as AccessApplicationRow;
        setApplications((prev) => prev.map((r) => (r.id === id ? updated : r)));
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

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const pendingApps = applications.filter((r) => r.status === "PENDING");

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <Shield className="h-8 w-8 text-orange-500" /> Admin access
        </h1>
        <p className="text-slate-400">
          Approve new administrator accounts or promote existing users to the admin team.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("applications")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            tab === "applications"
              ? "border-orange-500/30 bg-orange-500/20 text-orange-400"
              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" /> New access requests
            {pendingApps.length > 0 && (
              <span className="rounded-full bg-orange-500/30 px-2 py-0.5 text-xs">{pendingApps.length}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("role_upgrades")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            tab === "role_upgrades"
              ? "border-orange-500/30 bg-orange-500/20 text-orange-400"
              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Role upgrades (signed-in users)
            {pendingRequests.length > 0 && (
              <span className="rounded-full bg-orange-500/30 px-2 py-0.5 text-xs">{pendingRequests.length}</span>
            )}
          </span>
        </button>
      </div>

      {tab === "role_upgrades" && (
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === "PENDING"
                ? "border border-orange-500/30 bg-orange-500/20 text-orange-400"
                : "border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white"
            }`}
          >
            Pending ({pendingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "border border-orange-500/30 bg-orange-500/20 text-orange-400"
                : "border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
        </div>
      )}

      {tab === "applications" ? (
        appsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
            <UserPlus className="mx-auto mb-3 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">No access applications yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{app.name?.trim() || app.email}</p>
                    <p className="text-sm text-slate-400">{app.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Requested {new Date(app.requestedAt).toLocaleString()}
                    </p>
                    {app.status !== "PENDING" && app.reviewedBy && (
                      <p className="mt-1 text-xs text-slate-500">
                        {app.status} by {app.reviewedBy.name || app.reviewedBy.email}
                        {app.reviewedAt && ` at ${new Date(app.reviewedAt).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      app.status === "PENDING"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : app.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                {app.status === "PENDING" && (
                  <div className="mt-4 space-y-4 border-t border-slate-700/50 pt-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-400">Assign rights (optional)</p>
                      <div className="flex flex-wrap gap-3">
                        {RIGHTS_OPTIONS.map((r) => (
                          <label key={r.key} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedRights[app.id]?.[r.key] ?? false}
                              onChange={() => toggleRight(app.id, r.key)}
                              className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-sm text-slate-300">{r.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Denial note (if denying)</label>
                      <input
                        type="text"
                        value={denyNote[app.id] ?? ""}
                        onChange={(e) => setDenyNote((prev) => ({ ...prev, [app.id]: e.target.value }))}
                        placeholder="Optional reason"
                        className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleApplicationAction(app.id, "APPROVE")}
                        disabled={actionLoading === app.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {actionLoading === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approve & create admin
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApplicationAction(app.id, "DENY")}
                        disabled={actionLoading === app.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {actionLoading === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Deny
                      </button>
                    </div>
                  </div>
                )}

                {app.note && app.status === "DENIED" && (
                  <p className="mt-2 text-sm text-slate-500">Note: {app.note}</p>
                )}
              </div>
            ))}
          </div>
        )
      ) : reqLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
          <UserPlus className="mx-auto mb-3 h-12 w-12 text-slate-600" />
          <p className="text-slate-400">No role-upgrade requests found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{req.requestedBy.name || req.requestedBy.email}</p>
                  <p className="text-sm text-slate-400">{req.requestedBy.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Requested {new Date(req.requestedAt).toLocaleString()} · Current role: {req.requestedBy.role}
                  </p>
                  {req.status !== "PENDING" && req.reviewedBy && (
                    <p className="mt-1 text-xs text-slate-500">
                      {req.status} by {req.reviewedBy.name || req.reviewedBy.email}
                      {req.reviewedAt && ` at ${new Date(req.reviewedAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
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
                <div className="mt-4 space-y-4 border-t border-slate-700/50 pt-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-400">Assign rights (optional)</p>
                    <div className="flex flex-wrap gap-3">
                      {RIGHTS_OPTIONS.map((r) => (
                        <label key={r.key} className="flex cursor-pointer items-center gap-2">
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
                    <label className="mb-1 block text-xs font-medium text-slate-400">Denial note (if denying)</label>
                    <input
                      type="text"
                      value={denyNote[req.id] ?? ""}
                      onChange={(e) => setDenyNote((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="Optional reason"
                      className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRequestAction(req.id, "APPROVE")}
                      disabled={actionLoading === req.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRequestAction(req.id, "DENY")}
                      disabled={actionLoading === req.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Deny
                    </button>
                  </div>
                </div>
              )}

              {req.note && req.status === "DENIED" && <p className="mt-2 text-sm text-slate-500">Note: {req.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
