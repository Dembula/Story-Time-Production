"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, CheckCircle, XCircle, Loader2, UserPlus, Mail, Users, Crown, Save } from "lucide-react";
import {
  ADMIN_RIGHT_SUITES,
  adminRightsSummary,
  allAdminRights,
  type AdminRightsMap,
} from "@/lib/admin-permissions";

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

type ActiveAdminRow = {
  id: string;
  name: string | null;
  email: string | null;
  adminRights: AdminRightsMap | null;
  rightsSummary: string;
  isGod: boolean;
  createdAt: string;
};

const RIGHTS_OPTIONS = ADMIN_RIGHT_SUITES.map((s) => ({ key: s.key, label: s.label }));

type Tab = "applications" | "role_upgrades" | "active_admins";

async function adminFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      res.ok
        ? "Unexpected response from server."
        : `Request failed (${res.status}). ${text.slice(0, 120)}`,
    );
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status}).`);
  }
  return data;
}

export function AdminRequestsClient() {
  const [tab, setTab] = useState<Tab>("applications");
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [applications, setApplications] = useState<AccessApplicationRow[]>([]);
  const [activeAdmins, setActiveAdmins] = useState<ActiveAdminRow[]>([]);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [reqLoading, setReqLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "all">("PENDING");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState<Record<string, string>>({});
  const [selectedRights, setSelectedRights] = useState<Record<string, AdminRightsMap>>({});
  const [editingAdminRights, setEditingAdminRights] = useState<Record<string, AdminRightsMap>>({});
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadRoleUpgrades = useCallback(() => {
    return adminFetchJson<AdminRequestRow[]>(`/api/admin/requests?status=${filter}`).then(setRequests);
  }, [filter]);

  const loadApplications = useCallback(() => {
    return adminFetchJson<AccessApplicationRow[]>("/api/admin/access-applications").then(setApplications);
  }, []);

  const loadActiveAdmins = useCallback(() => {
    return adminFetchJson<{ admins: ActiveAdminRow[]; canManageTeam?: boolean }>("/api/admin/team")
      .then((data) => {
        setActiveAdmins(data.admins ?? []);
        setCanManageTeam(Boolean(data.canManageTeam));
        const rightsSeed: Record<string, AdminRightsMap> = {};
        for (const admin of data.admins ?? []) {
          rightsSeed[admin.id] =
            admin.adminRights === null ? allAdminRights() : { ...admin.adminRights };
        }
        setEditingAdminRights(rightsSeed);
      });
  }, []);

  useEffect(() => {
    setReqLoading(true);
    void loadRoleUpgrades()
      .catch(() => setMessage({ type: "err", text: "Could not load role upgrade requests." }))
      .finally(() => setReqLoading(false));
  }, [loadRoleUpgrades]);

  useEffect(() => {
    setAppsLoading(true);
    void loadApplications()
      .catch(() => setMessage({ type: "err", text: "Could not load access applications." }))
      .finally(() => setAppsLoading(false));
  }, [loadApplications]);

  useEffect(() => {
    void loadActiveAdmins().catch(() => {});
  }, [loadActiveAdmins]);

  useEffect(() => {
    if (tab !== "active_admins") return;
    setAdminsLoading(true);
    void loadActiveAdmins()
      .catch(() => setMessage({ type: "err", text: "Could not load active administrators." }))
      .finally(() => setAdminsLoading(false));
  }, [tab, loadActiveAdmins]);

  function toggleRight(entityId: string, key: string, map: "selected" | "editing") {
    const setter = map === "selected" ? setSelectedRights : setEditingAdminRights;
    setter((prev) => ({
      ...prev,
      [entityId]: {
        ...(prev[entityId] ?? {}),
        [key]: !prev[entityId]?.[key as keyof AdminRightsMap],
      },
    }));
  }

  async function handleRequestAction(id: string, action: "APPROVE" | "DENY") {
    setActionLoading(id);
    setMessage(null);
    const body: { id: string; action: string; assignedRights?: AdminRightsMap; note?: string } = { id, action };
    if (action === "APPROVE") body.assignedRights = selectedRights[id] ?? {};
    if (action === "DENY") body.note = denyNote[id] ?? undefined;
    try {
      const res = await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.id === id ? (data as AdminRequestRow) : r)));
        setMessage({ type: "ok", text: action === "APPROVE" ? "Role upgrade approved." : "Request denied." });
        void loadActiveAdmins();
      } else {
        setMessage({ type: "err", text: data.error ?? "Request action failed." });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApplicationAction(id: string, action: "APPROVE" | "DENY") {
    setActionLoading(id);
    setMessage(null);
    const body: { id: string; action: string; assignedRights?: AdminRightsMap; note?: string } = { id, action };
    if (action === "APPROVE") body.assignedRights = selectedRights[id] ?? {};
    if (action === "DENY") body.note = denyNote[id] ?? undefined;
    try {
      const res = await fetch("/api/admin/access-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApplications((prev) => prev.map((r) => (r.id === id ? (data as AccessApplicationRow) : r)));
        setMessage({ type: "ok", text: action === "APPROVE" ? "Admin account created." : "Application denied." });
        void loadActiveAdmins();
      } else {
        setMessage({ type: "err", text: data.error ?? "Application action failed." });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function saveAdminRights(userId: string) {
    setActionLoading(userId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "SET_ADMIN_RIGHTS",
          adminRights: editingAdminRights[userId] ?? {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: "Admin sections updated." });
        void loadActiveAdmins();
      } else {
        setMessage({ type: "err", text: data.error ?? "Could not save admin sections." });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function revokeAdminAccess(userId: string, label: string) {
    if (!window.confirm(`Revoke admin access for ${label}? They will lose access to the admin portal immediately.`)) {
      return;
    }
    setActionLoading(userId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "REVOKE_ADMIN_ACCESS" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: `Admin access revoked for ${label}.` });
        void loadActiveAdmins();
      } else {
        setMessage({ type: "err", text: data.error ?? "Could not revoke admin access." });
      }
    } finally {
      setActionLoading(null);
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const pendingApps = applications.filter((r) => r.status === "PENDING");

  function RightsPicker({ entityId, map }: { entityId: string; map: "selected" | "editing" }) {
    const current = map === "selected" ? selectedRights[entityId] : editingAdminRights[entityId];
    return (
      <div className="flex flex-wrap gap-3">
        {RIGHTS_OPTIONS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={current?.[r.key as keyof AdminRightsMap] === true}
              onChange={() => toggleRight(entityId, r.key, map)}
              className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-slate-300">{r.label}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <Shield className="h-8 w-8 text-orange-500" /> Admin access
        </h1>
        <p className="text-slate-400">
          Approve administrators, assign which sections they can access, and revoke access when needed.
        </p>
      </div>

      {message ? (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {message.text}
        </div>
      ) : null}

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
            <UserPlus className="h-4 w-4" /> Role upgrades
            {pendingRequests.length > 0 && (
              <span className="rounded-full bg-orange-500/30 px-2 py-0.5 text-xs">{pendingRequests.length}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("active_admins")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            tab === "active_admins"
              ? "border-orange-500/30 bg-orange-500/20 text-orange-400"
              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" /> Active administrators ({activeAdmins.length || "…"})
          </span>
        </button>
      </div>

      {tab === "active_admins" ? (
        adminsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : activeAdmins.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
            <Users className="mx-auto mb-3 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">No active administrators.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAdmins.map((admin) => (
              <div key={admin.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-white">
                      {admin.name?.trim() || admin.email}
                      {admin.isGod ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                          <Crown className="h-3 w-3" /> Platform owner
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-400">{admin.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{admin.rightsSummary}</p>
                  </div>
                </div>

                {!admin.isGod && canManageTeam ? (
                  <div className="mt-4 space-y-4 border-t border-slate-700/50 pt-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-400">Admin sections</p>
                      <RightsPicker entityId={admin.id} map="editing" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveAdminRights(admin.id)}
                        disabled={actionLoading === admin.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/30 disabled:opacity-50"
                      >
                        {actionLoading === admin.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save sections
                      </button>
                      <button
                        type="button"
                        onClick={() => void revokeAdminAccess(admin.id, admin.email ?? admin.name ?? "this user")}
                        disabled={actionLoading === admin.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Revoke admin access
                      </button>
                    </div>
                  </div>
                ) : admin.isGod ? (
                  <p className="mt-3 text-xs text-amber-400/80">
                    Permanent platform owner — cannot be modified or revoked.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : tab === "applications" ? (
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
                      <p className="mb-2 text-xs font-medium text-slate-400">
                        Assign admin sections (only checked sections will be accessible)
                      </p>
                      <RightsPicker entityId={app.id} map="selected" />
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
                        <XCircle className="h-4 w-4" /> Deny
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
        <>
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
                    {req.status === "APPROVED" && req.assignedRights && (
                      <p className="mt-1 text-xs text-slate-500">
                        Sections: {adminRightsSummary(req.assignedRights, req.requestedBy.email)}
                      </p>
                    )}
                  </div>
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

                {req.status === "PENDING" && (
                  <div className="mt-4 space-y-4 border-t border-slate-700/50 pt-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-400">Assign admin sections</p>
                      <RightsPicker entityId={req.id} map="selected" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRequestAction(req.id, "APPROVE")}
                        disabled={actionLoading === req.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRequestAction(req.id, "DENY")}
                        disabled={actionLoading === req.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Deny
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
