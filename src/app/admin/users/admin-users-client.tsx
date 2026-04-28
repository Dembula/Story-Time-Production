"use client";

import { useEffect, useState } from "react";
import {
  Users, Shield, Trash2, Edit3, ChevronDown, ChevronUp, Search,
  Film, Music, Eye, MessageSquare, Star, Activity, Package,
  UserCheck, UserX, GraduationCap, AlertTriangle,
} from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  userRoles?: { role: string }[];
  creatorAccountStructure?: "INDIVIDUAL" | "COMPANY" | null;
  creatorTeamSeatCap?: number | null;
  bio: string | null;
  isAfdaStudent: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { contents: number; musicTracks: number; watchSessions: number; comments: number; ratings: number; activityLogs: number; equipmentListings: number; locationListings: number };
}

const ROLES = ["SUBSCRIBER", "CONTENT_CREATOR", "MUSIC_CREATOR", "EQUIPMENT_COMPANY", "LOCATION_OWNER", "CREW_TEAM", "CASTING_AGENCY", "ADMIN"];

function roleBadge(role: string) {
  const m: Record<string, string> = {
    ADMIN: "bg-red-500/20 text-red-400",
    CONTENT_CREATOR: "bg-emerald-500/20 text-emerald-400",
    MUSIC_CREATOR: "bg-pink-500/20 text-pink-400",
    EQUIPMENT_COMPANY: "bg-blue-500/20 text-blue-400",
    LOCATION_OWNER: "bg-amber-500/20 text-amber-400",
    CREW_TEAM: "bg-teal-500/20 text-teal-400",
    CASTING_AGENCY: "bg-violet-500/20 text-violet-400",
    SUBSCRIBER: "bg-slate-700 text-slate-400",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${m[role] || m.SUBSCRIBER}`}>{role.replace(/_/g, " ")}</span>;
}

function getRoleList(user: User): string[] {
  const roles = user.userRoles?.map((entry) => entry.role).filter(Boolean) ?? [];
  if (roles.length > 0) return Array.from(new Set(roles));
  return [user.role];
}

export function AdminUsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [creatorAccountStructure, setCreatorAccountStructure] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [creatorTeamSeatCap, setCreatorTeamSeatCap] = useState("1");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.json()).then(setUsers).finally(() => setLoading(false));
  }, []);

  async function handleAction(userId: string, action: string, data?: Record<string, unknown>) {
    setActionLoading(userId);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action, ...data }),
    });
    if (res.ok) {
      if (action === "DELETE") {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setConfirmDelete(null);
      } else {
        const updated = await res.json().catch(() => null);
        if (updated && typeof updated === "object" && "id" in updated) {
          setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
        }
        if (action === "UPDATE_PASSWORD") setEditPassword("");
      }
    }
    setActionLoading(null);
    setExpanded(null);
  }

  const filtered = users.filter((u) => {
    const matchesSearch = !search || (u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
    const userRoles = getRoleList(u);
    const matchesRole = roleFilter === "ALL" || userRoles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const roleCounts = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter((u) => getRoleList(u).includes(r)).length;
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-orange-500" /> User Management
        </h1>
        <p className="text-slate-400">Manage accounts, roles, and permissions for all platform users.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[{ label: "All Users", value: users.length, filter: "ALL" }, ...ROLES.map((r) => ({ label: r.replace(/_/g, " "), value: roleCounts[r] || 0, filter: r }))].map((s) => (
          <button key={s.filter} onClick={() => setRoleFilter(s.filter)} className={`p-4 rounded-xl border text-left transition ${roleFilter === s.filter ? "border-orange-500 bg-orange-500/10" : "border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50"}`}>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
        </div>
        <p className="text-sm text-slate-400">{filtered.length} of {users.length} users</p>
      </div>

      <div className="space-y-3">
        {filtered.map((u) => (
          <div key={u.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="p-5 flex items-center gap-4 cursor-pointer hover:bg-slate-800/70 transition" onClick={() => { setExpanded(expanded === u.id ? null : u.id); setEditName(u.name || ""); setEditRole(u.role); setEditEmail(u.email || ""); setSelectedRoles(getRoleList(u)); setCreatorAccountStructure(u.creatorAccountStructure === "COMPANY" ? "COMPANY" : "INDIVIDUAL"); setCreatorTeamSeatCap(String(u.creatorTeamSeatCap ?? 1)); }}>
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-medium">{u.name || "Unnamed"}</p>
                  {getRoleList(u).map((roleName) => (
                    <span key={roleName}>{roleBadge(roleName)}</span>
                  ))}
                  {u.isAfdaStudent && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400"><GraduationCap className="w-3 h-3 inline" /> Student</span>}
                </div>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
              </div>
              <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Film className="w-3 h-3" /> {u._count.contents}</span>
                <span className="flex items-center gap-1"><Music className="w-3 h-3" /> {u._count.musicTracks}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {u._count.watchSessions}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {u._count.comments}</span>
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {u._count.activityLogs}</span>
              </div>
              <span className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</span>
              {expanded === u.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {expanded === u.id && (
              <div className="border-t border-slate-700/50 p-5 bg-slate-900/30 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Content Uploads", value: u._count.contents, icon: Film },
                    { label: "Music Tracks", value: u._count.musicTracks, icon: Music },
                    { label: "Watch Sessions", value: u._count.watchSessions, icon: Eye },
                    { label: "Comments", value: u._count.comments, icon: MessageSquare },
                    { label: "Ratings Given", value: u._count.ratings, icon: Star },
                    { label: "Login Events", value: u._count.activityLogs, icon: Activity },
                    { label: "Equipment Listings", value: u._count.equipmentListings, icon: Package },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3 h-3 text-orange-400" /><span className="text-xs text-slate-500">{s.label}</span></div>
                      <p className="text-lg font-bold text-white">{s.value}</p>
                    </div>
                  ))}
                </div>

                {u.bio && <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30"><p className="text-xs text-slate-500 mb-1">Bio</p><p className="text-sm text-slate-300">{u.bio}</p></div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2"><Edit3 className="w-4 h-4 text-orange-400" /> Edit User</h4>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                      <div className="flex gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        <button onClick={() => handleAction(u.id, "UPDATE_NAME", { newName: editName })} disabled={actionLoading === u.id} className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition disabled:opacity-50">Save</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Role</label>
                      <div className="flex gap-2">
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
                          {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                        </select>
                        <button onClick={() => handleAction(u.id, "CHANGE_ROLE", { newRole: editRole })} disabled={actionLoading === u.id || editRole === u.role} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition disabled:opacity-50">Update</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email</label>
                      <div className="flex gap-2">
                        <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        <button onClick={() => handleAction(u.id, "UPDATE_EMAIL", { newEmail: editEmail })} disabled={actionLoading === u.id || editEmail === (u.email || "")} className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition disabled:opacity-50">Update</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Reset Password</label>
                      <div className="flex gap-2">
                        <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="New password (min 8 chars)" className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        <button onClick={() => handleAction(u.id, "UPDATE_PASSWORD", { newPassword: editPassword })} disabled={actionLoading === u.id || editPassword.length < 8} className="px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition disabled:opacity-50">Reset</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">Multi-role access</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700/40 p-3 bg-slate-900/40">
                        {ROLES.map((r) => (
                          <label key={r} className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={selectedRoles.includes(r)}
                              onChange={(e) => {
                                setSelectedRoles((prev) => {
                                  if (e.target.checked) return Array.from(new Set([...prev, r]));
                                  const next = prev.filter((roleName) => roleName !== r);
                                  return next.length > 0 ? next : ["SUBSCRIBER"];
                                });
                              }}
                            />
                            {r.replace(/_/g, " ")}
                          </label>
                        ))}
                      </div>
                      <button onClick={() => handleAction(u.id, "SET_ROLES", { roles: selectedRoles, newRole: selectedRoles[0] ?? "SUBSCRIBER" })} disabled={actionLoading === u.id || selectedRoles.length === 0} className="mt-2 px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition disabled:opacity-50">Save roles</button>
                    </div>
                    {(selectedRoles.includes("CONTENT_CREATOR") || selectedRoles.includes("MUSIC_CREATOR")) && (
                      <div className="rounded-lg border border-slate-700/40 p-3 bg-slate-900/30 space-y-2">
                        <p className="text-xs text-slate-400">Creator account type</p>
                        <div className="flex gap-2">
                          <select value={creatorAccountStructure} onChange={(e) => setCreatorAccountStructure(e.target.value === "COMPANY" ? "COMPANY" : "INDIVIDUAL")} className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
                            <option value="INDIVIDUAL">Individual</option>
                            <option value="COMPANY">Company / team</option>
                          </select>
                          {creatorAccountStructure === "COMPANY" ? (
                            <input value={creatorTeamSeatCap} onChange={(e) => setCreatorTeamSeatCap(e.target.value)} className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                          ) : null}
                        </div>
                        <button onClick={() => handleAction(u.id, "UPDATE_CREATOR_ACCOUNT_STRUCTURE", { accountStructure: creatorAccountStructure, teamSeatCap: creatorTeamSeatCap })} disabled={actionLoading === u.id} className="px-3 py-2 bg-violet-500 text-white rounded-lg text-sm hover:bg-violet-600 transition disabled:opacity-50">Save creator type</button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Danger Zone</h4>
                    {confirmDelete === u.id ? (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
                        <p className="text-sm text-red-400">Are you sure you want to permanently delete <strong>{u.name || u.email}</strong>? This cannot be undone. All their content, tracks, comments, and data will be removed.</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(u.id, "DELETE")} disabled={actionLoading === u.id} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition disabled:opacity-50">Yes, Delete Permanently</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(u.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition text-sm font-medium">
                        <Trash2 className="w-4 h-4" /> Delete User Account
                      </button>
                    )}
                    <p className="text-xs text-slate-500">Account created {new Date(u.createdAt).toLocaleString()} · Last updated {new Date(u.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
