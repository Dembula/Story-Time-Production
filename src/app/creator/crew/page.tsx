"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/layout/back-button";
import {
  Users,
  Briefcase,
  MapPin,
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";

type CrewRosterEntry = {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  contactEmail: string | null;
  phone: string | null;
  notes: string | null;
  pastProjects: string | null;
};
type CrewTeam = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  specializations: string | null;
  pastWorkSummary: string | null;
  user: { id: string; name: string | null; email: string | null };
  _count: { members: number; requests: number };
};
type CrewTeamDetail = CrewTeam & {
  members: { id: string; name: string; role: string; department: string | null; bio: string | null; skills: string | null; pastWork: string | null }[];
};

export default function CreatorCrewPage() {
  const [tab, setTab] = useState<"my-roster" | "find-crew">("my-roster");
  const [crewRoster, setCrewRoster] = useState<CrewRosterEntry[]>([]);
  const [crewTeams, setCrewTeams] = useState<CrewTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<CrewTeamDetail | null>(null);
  const [success, setSuccess] = useState("");
  const [crewForm, setCrewForm] = useState({ name: "", role: "", department: "", contactEmail: "", phone: "", notes: "", pastProjects: "" });
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [requestTeamId, setRequestTeamId] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({ projectName: "", message: "" });

  useEffect(() => {
    const load = async () => {
      const [crew, teams] = await Promise.all([
        fetch("/api/creator/crew-roster").then((r) => r.json()),
        fetch("/api/crew-teams").then((r) => r.json()),
      ]);
      setCrewRoster(Array.isArray(crew) ? crew : []);
      setCrewTeams(Array.isArray(teams) ? teams : []);
      setLoading(false);
    };
    load();
  }, []);

  async function loadTeamDetail(id: string) {
    const r = await fetch(`/api/crew-teams/${id}`);
    if (r.ok) setTeamDetail(await r.json());
  }

  async function addCrewEntry() {
    const res = await fetch("/api/creator/crew-roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crewForm),
    });
    if (res.ok) {
      const entry = await res.json();
      setCrewRoster((prev) => [entry, ...prev]);
      setCrewForm({ name: "", role: "", department: "", contactEmail: "", phone: "", notes: "", pastProjects: "" });
      setShowCrewForm(false);
      setSuccess("Crew member added.");
      setTimeout(() => setSuccess(""), 3000);
    }
  }
  async function deleteCrewEntry(id: string) {
    if (!confirm("Remove this crew member from your roster?")) return;
    const res = await fetch(`/api/creator/crew-roster/${id}`, { method: "DELETE" });
    if (res.ok) setCrewRoster((prev) => prev.filter((e) => e.id !== id));
  }
  async function sendCrewRequest(crewTeamId: string) {
    const res = await fetch("/api/crew-teams/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crewTeamId, projectName: requestForm.projectName, message: requestForm.message }),
    });
    if (res.ok) {
      setRequestTeamId(null);
      setRequestForm({ projectName: "", message: "" });
      setSuccess("Request sent to crew team.");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <BackButton fallback="/creator/dashboard" />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-emerald-500" />
            Crew
          </h1>
          <p className="text-slate-400">Your crew repository and find crew teams on the platform</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("my-roster")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "my-roster" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"}`}
          >
            My Crew Roster ({crewRoster.length})
          </button>
          <button
            onClick={() => setTab("find-crew")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "find-crew" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"}`}
          >
            Find Crew Teams
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {tab === "my-roster" && (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your crew repository</h2>
            <button
              onClick={() => setShowCrewForm(!showCrewForm)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add crew
            </button>
          </div>
          {showCrewForm && (
            <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-600 space-y-3">
              <input placeholder="Name" value={crewForm.name} onChange={(e) => setCrewForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Role" value={crewForm.role} onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
                <input placeholder="Department" value={crewForm.department} onChange={(e) => setCrewForm((f) => ({ ...f, department: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              </div>
              <input placeholder="Email" value={crewForm.contactEmail} onChange={(e) => setCrewForm((f) => ({ ...f, contactEmail: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <input placeholder="Phone" value={crewForm.phone} onChange={(e) => setCrewForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <textarea placeholder="Notes" value={crewForm.notes} onChange={(e) => setCrewForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" rows={2} />
              <textarea placeholder="Past projects" value={crewForm.pastProjects} onChange={(e) => setCrewForm((f) => ({ ...f, pastProjects: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" rows={2} />
              <div className="flex gap-2">
                <button onClick={addCrewEntry} disabled={!crewForm.name.trim()} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50">Save</button>
                <button onClick={() => setShowCrewForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
              </div>
            </div>
          )}
          {crewRoster.length === 0 && !showCrewForm ? (
            <p className="text-slate-500 text-sm">No crew in your roster yet. Add people you work with.</p>
          ) : (
            <div className="grid gap-3">
              {crewRoster.map((e) => (
                <div key={e.id} className="flex items-start justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div>
                    <p className="font-medium text-white">{e.name}</p>
                    <p className="text-sm text-emerald-400">{[e.role, e.department].filter(Boolean).join(" · ") || "Crew"}</p>
                    {(e.contactEmail || e.phone) && <p className="text-xs text-slate-500 mt-1">{e.contactEmail || e.phone}</p>}
                    {(e.notes || e.pastProjects) && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{e.notes || e.pastProjects}</p>}
                  </div>
                  <button onClick={() => deleteCrewEntry(e.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "find-crew" && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Browse crew teams on the platform and send a request for your project.</p>
          {crewTeams.length === 0 ? (
            <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">No crew teams listed yet. Crew teams can join via Creator Sign Up.</div>
          ) : (
            <div className="space-y-4">
              {crewTeams.map((team) => (
                <div key={team.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
                  <button
                    onClick={() => {
                      setExpandedTeamId(expandedTeamId === team.id ? null : team.id);
                      if (expandedTeamId !== team.id) loadTeamDetail(team.id);
                    }}
                    className="w-full p-5 flex items-center justify-between text-left"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-white">{team.companyName}</h3>
                      {team.tagline && <p className="text-sm text-slate-400 mt-0.5">{team.tagline}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                        {(team.city || team.country) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {[team.city, team.country].filter(Boolean).join(", ")}
                          </span>
                        )}
                        <span>{team._count.members} members</span>
                        {team.specializations && <span>{team.specializations}</span>}
                      </div>
                    </div>
                    {expandedTeamId === team.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </button>
                  {expandedTeamId === team.id && teamDetail?.id === team.id && (
                    <div className="px-5 pb-5 border-t border-slate-700/50 pt-4 space-y-4">
                      {teamDetail.description && <p className="text-sm text-slate-400 leading-relaxed">{teamDetail.description}</p>}
                      {teamDetail.pastWorkSummary && (
                        <p className="text-sm text-slate-500">
                          <strong className="text-slate-400">Past work:</strong> {teamDetail.pastWorkSummary}
                        </p>
                      )}
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Team members</h4>
                        <div className="grid gap-2">
                          {teamDetail.members.map((m) => (
                            <div key={m.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                              <p className="font-medium text-white">
                                {m.name} · {m.role}
                              </p>
                              {m.department && <p className="text-xs text-emerald-400">{m.department}</p>}
                              {(m.bio || m.skills || m.pastWork) && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.bio || m.skills || m.pastWork}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRequestTeamId(team.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
                        >
                          <Send className="w-4 h-4" /> Request this team
                        </button>
                      </div>
                      {requestTeamId === team.id && (
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600 space-y-3">
                          <input placeholder="Project name" value={requestForm.projectName} onChange={(e) => setRequestForm((f) => ({ ...f, projectName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
                          <textarea placeholder="Message" value={requestForm.message} onChange={(e) => setRequestForm((f) => ({ ...f, message: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" rows={3} />
                          <div className="flex gap-2">
                            <button onClick={() => sendCrewRequest(team.id)} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm">Send request</button>
                            <button onClick={() => setRequestTeamId(null)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
