"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import {
  Users,
  MapPin,
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Megaphone,
  FileText,
  Film,
  CheckCircle,
} from "lucide-react";

type CastRosterEntry = {
  id: string;
  name: string;
  roleType: string | null;
  contactEmail: string | null;
  notes: string | null;
  pastWork: string | null;
};
type CastingAgency = {
  id: string;
  agencyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  user: { id: string; name: string | null; email: string | null };
  _count: { talent: number; inquiries: number };
};
type CastingAgencyDetail = CastingAgency & {
  talent: {
    id: string;
    name: string;
    bio: string | null;
    cvUrl: string | null;
    headshotUrl: string | null;
    ageRange: string | null;
    skills: string | null;
    pastWork: string | null;
    reelUrl: string | null;
  }[];
};
type Audition = { id: string; roleName: string; description: string | null; status: string; createdAt: string; content: { title: string } };
type ContentOption = { id: string; title: string };

export default function CreatorCastPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const roleIdFromUrl = searchParams.get("roleId") || "";

  const [tab, setTab] = useState<"my-roster" | "find-cast" | "auditions">("my-roster");
  const [castRoster, setCastRoster] = useState<CastRosterEntry[]>([]);
  const [agencies, setAgencies] = useState<CastingAgency[]>([]);
  const [auditions, setAuditions] = useState<Audition[]>([]);
  const [contents, setContents] = useState<ContentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgencyId, setExpandedAgencyId] = useState<string | null>(null);
  const [agencyDetail, setAgencyDetail] = useState<CastingAgencyDetail | null>(null);
  const [success, setSuccess] = useState("");
  const [castForm, setCastForm] = useState({ name: "", roleType: "", contactEmail: "", notes: "", pastWork: "" });
  const [showCastForm, setShowCastForm] = useState(false);
  const [inquiryAgencyId, setInquiryAgencyId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState(roleIdFromUrl);
  const [inquiryForm, setInquiryForm] = useState({ projectName: "", roleName: "", message: "", talentId: "" });
  const [auditionForm, setAuditionForm] = useState({ contentId: "", roleName: "", description: "" });
  const [showAuditionForm, setShowAuditionForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [cast, agys, auds, cont] = await Promise.all([
        fetch("/api/creator/cast-roster").then((r) => r.json()),
        fetch("/api/casting-agencies").then((r) => r.json()),
        fetch("/api/auditions").then((r) => r.json()),
        fetch("/api/creator/content").then((r) => r.json()).then((arr: { id: string; title: string }[]) => (Array.isArray(arr) ? arr : [])),
      ]);
      setCastRoster(Array.isArray(cast) ? cast : []);
      setAgencies(Array.isArray(agys) ? agys : []);
      setAuditions(Array.isArray(auds) ? auds : []);
      setContents(Array.isArray(cont) ? cont : []);
      setLoading(false);
    };
    load();
  }, []);

  async function loadAgencyDetail(id: string) {
    const r = await fetch(`/api/casting-agencies/${id}`);
    if (r.ok) setAgencyDetail(await r.json());
  }

  async function addCastEntry() {
    const res = await fetch("/api/creator/cast-roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(castForm),
    });
    if (res.ok) {
      const entry = await res.json();
      setCastRoster((prev) => [entry, ...prev]);
      setCastForm({ name: "", roleType: "", contactEmail: "", notes: "", pastWork: "" });
      setShowCastForm(false);
      setSuccess("Cast member added.");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  async function deleteCastEntry(id: string) {
    if (!confirm("Remove this cast from your roster?")) return;
    const res = await fetch(`/api/creator/cast-roster/${id}`, { method: "DELETE" });
    if (res.ok) setCastRoster((prev) => prev.filter((e) => e.id !== id));
  }

  async function sendInquiry(agencyId: string) {
    const res = await fetch("/api/casting-agencies/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyId,
        projectName: inquiryForm.projectName,
        roleName: inquiryForm.roleName,
        message: inquiryForm.message,
        talentId: inquiryForm.talentId || undefined,
      }),
    });
    if (res.ok) {
      setInquiryAgencyId(null);
      setInquiryForm({ projectName: "", roleName: "", message: "", talentId: "" });
      setSuccess("Inquiry sent to agency.");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  async function inviteForRole(agencyId: string, talentId: string, defaultRoleName: string) {
    if (!projectId || !selectedRoleId) {
      alert("Open a specific project and role in Casting portal to send a formal invitation.");
      return;
    }
    const res = await fetch(`/api/creator/projects/${projectId}/casting/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roleId: selectedRoleId,
        castingAgencyId: agencyId,
        talentId,
        message: `Invitation for role: ${inquiryForm.roleName || defaultRoleName}`,
      }),
    });
    if (res.ok) {
      setSuccess("Invitation sent to agency for this talent.");
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Could not send invitation. Check project access.");
    }
  }

  async function postAudition() {
    if (!auditionForm.contentId || !auditionForm.roleName) return;
    const res = await fetch("/api/auditions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId: auditionForm.contentId,
        roleName: auditionForm.roleName,
        description: auditionForm.description,
        status: "OPEN",
      }),
    });
    if (res.ok) {
      const a = await res.json();
      setAuditions((prev) => [{ ...a, content: { title: contents.find((c) => c.id === auditionForm.contentId)?.title ?? "" } }, ...prev]);
      setAuditionForm({ contentId: "", roleName: "", description: "" });
      setShowAuditionForm(false);
      setSuccess("Audition posted.");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <BackButton fallback="/creator/dashboard" />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-violet-500" />
            Cast & Auditions
          </h1>
          <p className="text-slate-400">
            Your cast repository, find casting agencies and talent, and post auditions.{" "}
            {projectId && (
              <span className="text-xs text-slate-500 block mt-1">
                Invitations are currently linked to project <span className="font-mono">{projectId}</span>
                {selectedRoleId ? (
                  <> and a specific role.</>
                ) : (
                  <>. Open a role in the project casting portal to invite a specific talent.</>
                )}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("my-roster")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "my-roster" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"}`}
          >
            My Cast Roster ({castRoster.length})
          </button>
          <button
            onClick={() => setTab("find-cast")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "find-cast" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"}`}
          >
            Find Cast
          </button>
          <button
            onClick={() => setTab("auditions")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "auditions" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"}`}
          >
            Auditions ({auditions.length})
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
            <h2 className="text-lg font-semibold text-white">Your cast repository</h2>
            <button
              onClick={() => setShowCastForm(!showCastForm)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add cast
            </button>
          </div>
          {showCastForm && (
            <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-600 space-y-3">
              <input placeholder="Name" value={castForm.name} onChange={(e) => setCastForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <input placeholder="Role type (e.g. Actor)" value={castForm.roleType} onChange={(e) => setCastForm((f) => ({ ...f, roleType: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <input placeholder="Email" value={castForm.contactEmail} onChange={(e) => setCastForm((f) => ({ ...f, contactEmail: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <textarea placeholder="Notes / Past work" value={castForm.notes || castForm.pastWork} onChange={(e) => setCastForm((f) => ({ ...f, notes: e.target.value, pastWork: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" rows={3} />
              <div className="flex gap-2">
                <button onClick={addCastEntry} disabled={!castForm.name.trim()} className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">Save</button>
                <button onClick={() => setShowCastForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
              </div>
            </div>
          )}
          {castRoster.length === 0 && !showCastForm ? (
            <p className="text-slate-500 text-sm">No cast in your roster yet.</p>
          ) : (
            <div className="grid gap-3">
              {castRoster.map((e) => (
                <div key={e.id} className="flex items-start justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div>
                    <p className="font-medium text-white">{e.name}</p>
                    <p className="text-sm text-violet-400">{e.roleType || "Talent"}</p>
                    {(e.contactEmail || e.notes) && <p className="text-xs text-slate-400 mt-1">{e.contactEmail || e.notes}</p>}
                  </div>
                  <button onClick={() => deleteCastEntry(e.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "find-cast" && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Browse casting agencies and their talent. Send an inquiry for a role or project, or invite a specific talent to a project role.</p>
          {projectId && (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
              <p className="font-medium text-slate-200 mb-1">Project-aware invitations</p>
              <p>
                When you open this page from the Casting portal for a specific film, it passes the project and role into this view. Use{" "}
                <span className="font-semibold">Invite to role</span> on any talent card to send a formal invitation that the agency can accept.
              </p>
            </div>
          )}
          {agencies.length === 0 ? (
            <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">No casting agencies listed yet.</div>
          ) : (
            <div className="space-y-4">
              {agencies.map((agency) => (
                <div key={agency.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
                  <button
                    onClick={() => {
                      setExpandedAgencyId(expandedAgencyId === agency.id ? null : agency.id);
                      if (expandedAgencyId !== agency.id) loadAgencyDetail(agency.id);
                    }}
                    className="w-full p-5 flex items-center justify-between text-left"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-white">{agency.agencyName}</h3>
                      {agency.tagline && <p className="text-sm text-slate-400 mt-0.5">{agency.tagline}</p>}
                      <div className="flex gap-3 mt-2 text-xs text-slate-500">
                        {(agency.city || agency.country) && (
                          <span>
                            <MapPin className="w-3 h-3 inline" /> {[agency.city, agency.country].filter(Boolean).join(", ")}
                          </span>
                        )}
                        <span>{agency._count.talent} talent</span>
                      </div>
                    </div>
                    {expandedAgencyId === agency.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </button>
                  {expandedAgencyId === agency.id && agencyDetail?.id === agency.id && (
                    <div className="px-5 pb-5 border-t border-slate-700/50 pt-4 space-y-4">
                      {agencyDetail.description && <p className="text-sm text-slate-400 leading-relaxed">{agencyDetail.description}</p>}
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Talent</h4>
                        <div className="grid gap-3">
                          {agencyDetail.talent.map((t) => (
                            <div key={t.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30 flex gap-4">
                              {t.headshotUrl && <img src={t.headshotUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white">{t.name}</p>
                                {(t.ageRange || t.skills) && <p className="text-xs text-violet-400">{[t.ageRange, t.skills].filter(Boolean).join(" · ")}</p>}
                                {t.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.bio}</p>}
                                {t.pastWork && <p className="text-xs text-slate-600 mt-1 line-clamp-1">{t.pastWork}</p>}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {t.cvUrl && (
                                    <a href={t.cvUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                                      <FileText className="w-3 h-3" /> CV
                                    </a>
                                  )}
                                  {t.reelUrl && (
                                    <a href={t.reelUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                                      <Film className="w-3 h-3" /> Reel
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => inviteForRole(agency.id, t.id, t.name)}
                                    className="ml-auto px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-medium hover:bg-orange-600"
                                  >
                                    Invite to role
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setInquiryAgencyId(agency.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600"
                        >
                          <Send className="w-4 h-4" /> General inquiry
                        </button>
                      </div>
                      {inquiryAgencyId === agency.id && (
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600 space-y-3">
                          <input placeholder="Project name" value={inquiryForm.projectName} onChange={(e) => setInquiryForm((f) => ({ ...f, projectName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
                          <input placeholder="Role name" value={inquiryForm.roleName} onChange={(e) => setInquiryForm((f) => ({ ...f, roleName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
                          <textarea placeholder="Message" value={inquiryForm.message} onChange={(e) => setInquiryForm((f) => ({ ...f, message: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" rows={3} />
                          <div className="flex gap-2">
                            <button onClick={() => sendInquiry(agency.id)} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm">Send inquiry</button>
                            <button onClick={() => setInquiryAgencyId(null)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
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

      {tab === "auditions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">My audition posts</h2>
            <button
              onClick={() => setShowAuditionForm(!showAuditionForm)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 text-sm font-medium"
            >
              <Megaphone className="w-4 h-4" /> Post audition
            </button>
          </div>
          {showAuditionForm && (
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600 space-y-3">
              <select value={auditionForm.contentId} onChange={(e) => setAuditionForm((f) => ({ ...f, contentId: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm">
                <option value="">Select production from your content library</option>
                {contents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <input placeholder="Role name" value={auditionForm.roleName} onChange={(e) => setAuditionForm((f) => ({ ...f, roleName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
              <textarea placeholder="Description / requirements" value={auditionForm.description} onChange={(e) => setAuditionForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" rows={3} />
              <div className="flex gap-2">
                <button onClick={postAudition} disabled={!auditionForm.contentId || !auditionForm.roleName} className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
                  Post
                </button>
                <button onClick={() => setShowAuditionForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {auditions.length === 0 ? (
            <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No audition posts yet. Post a role for your production.</div>
          ) : (
            <div className="space-y-3">
              {auditions.map((a) => (
                <div key={a.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{a.roleName}</h3>
                    <p className="text-sm text-orange-400">for {a.content.title}</p>
                    {a.description && <p className="text-sm text-slate-400 mt-2">{a.description}</p>}
                    <p className="text-xs text-slate-500 mt-2">Posted {new Date(a.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${a.status === "OPEN" ? "bg-green-500/10 text-green-400" : "bg-slate-700 text-slate-400"}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
