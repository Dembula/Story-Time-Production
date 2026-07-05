"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import {
  CreatorProjectContextBanner,
  useCreatorProjectContext,
  usePrefillProjectName,
} from "@/components/creator/creator-project-context";
import { fetchMarketplaceList, postMarketplaceJson } from "@/lib/creator-marketplace-fetch";
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
  MessageCircle,
} from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { AUDITION_LISTING_FEE_ZAR } from "@/lib/pricing";
import { SecureFileLink } from "@/components/files/secure-file-link";
import { SecureImage } from "@/components/files/secure-image";

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
type TalentProfile = {
  plainBio: string;
  dailyRate: number | null;
  projectRate: number | null;
  hourlyRate?: number | null;
  weeklyRate?: number | null;
  experienceLevel: string | null;
  location: string | null;
  availability: string | null;
  languages: string[];
  unionStatus?: string | null;
  height?: string | null;
  eyeColor?: string | null;
  hairColor?: string | null;
  phone?: string | null;
  agentName?: string | null;
  travelWillingness?: string | null;
};

type CastingAgencyDetail = CastingAgency & {
  talent: {
    id: string;
    name: string;
    bio: string | null;
    plainBio?: string;
    cvUrl: string | null;
    headshotUrl: string | null;
    previewImageUrl?: string | null;
    ageRange: string | null;
    skills: string | null;
    pastWork: string | null;
    reelUrl: string | null;
    profile?: TalentProfile;
  }[];
};
type Audition = { id: string; roleName: string; description: string | null; status: string; createdAt: string; content: { title: string } };
type ContentOption = { id: string; title: string };

type MyCastingInquiry = {
  id: string;
  status: string;
  projectName: string | null;
  roleName: string | null;
  message: string | null;
  createdAt: string;
  paymentTransactionId?: string | null;
  agency: { id: string; agencyName: string };
};

function CreatorCastPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const roleIdFromUrl = searchParams.get("roleId") || "";
  const { projectTitle } = useCreatorProjectContext({
    phase: "PRE_PRODUCTION",
    toolSlug: "casting-portal",
  });

  const [tab, setTab] = useState<"my-roster" | "find-cast" | "auditions" | "my-inquiries">(
    projectId ? "find-cast" : "my-roster",
  );
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
  const [myInquiries, setMyInquiries] = useState<MyCastingInquiry[]>([]);
  const [loadError, setLoadError] = useState("");
  const [projectRoles, setProjectRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [paidAuditionForm, setPaidAuditionForm] = useState({ roleId: "", scheduledAt: "", details: "" });
  const [paidAuditionBusy, setPaidAuditionBusy] = useState(false);

  const prefillInquiry = useCallback(
    (title: string) => {
      setInquiryForm((f) => (f.projectName.trim() ? f : { ...f, projectName: title }));
    },
    [],
  );
  usePrefillProjectName(projectTitle, prefillInquiry);

  useEffect(() => {
    const load = async () => {
      const [cast, agysRes, auds, cont, inq] = await Promise.all([
        fetch("/api/creator/cast-roster").then((r) => r.json()),
        fetchMarketplaceList<CastingAgency>("/api/casting-agencies"),
        fetch("/api/auditions").then((r) => r.json()),
        fetch("/api/creator/content").then((r) => r.json()).then((arr: { id: string; title: string }[]) => (Array.isArray(arr) ? arr : [])),
        fetch("/api/casting-agencies/inquiries").then((r) => (r.ok ? r.json() : [])),
      ]);
      setCastRoster(Array.isArray(cast) ? cast : []);
      setAgencies(agysRes.data);
      if (agysRes.error) setLoadError(agysRes.error);
      setAuditions(Array.isArray(auds) ? auds : []);
      setContents(Array.isArray(cont) ? cont : []);
      setMyInquiries(Array.isArray(inq) ? inq : []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProjectRoles([]);
      return;
    }
    fetch(`/api/creator/projects/${projectId}/casting`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const roles = Array.isArray(data?.roles) ? data.roles : [];
        setProjectRoles(roles.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
        if (roles.length > 0) {
          setPaidAuditionForm((f) => {
            if (f.roleId && roles.some((r: { id: string }) => r.id === f.roleId)) return f;
            const match = roleIdFromUrl ? roles.find((r: { id: string }) => r.id === roleIdFromUrl) : null;
            return { ...f, roleId: match?.id ?? roles[0].id };
          });
        }
      })
      .catch(() => setProjectRoles([]));
  }, [projectId, roleIdFromUrl]);

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
    const { data: row, error } = await postMarketplaceJson<{
      id: string;
      status?: string;
      projectName?: string | null;
      roleName?: string | null;
      message?: string | null;
      createdAt?: string;
      paymentTransactionId?: string | null;
    }>("/api/casting-agencies/inquiries", {
      agencyId,
      projectName: inquiryForm.projectName || projectTitle || undefined,
      roleName: inquiryForm.roleName,
      message: inquiryForm.message,
      talentId: inquiryForm.talentId || undefined,
    });
    if (error || !row) {
      alert(error || "Could not send inquiry");
      return;
    }
    const agencyMeta = agencies.find((a) => a.id === agencyId);
    setMyInquiries((prev) => [
      {
        id: row.id,
        status: row.status ?? "PENDING",
        projectName: row.projectName ?? inquiryForm.projectName ?? null,
        roleName: row.roleName ?? null,
        message: row.message ?? null,
        createdAt: row.createdAt ?? new Date().toISOString(),
        paymentTransactionId: row.paymentTransactionId ?? null,
        agency: { id: agencyId, agencyName: agencyMeta?.agencyName ?? "Agency" },
      },
      ...prev,
    ]);
    setInquiryAgencyId(null);
    setInquiryForm({ projectName: projectTitle || "", roleName: "", message: "", talentId: "" });
    setSuccess("Inquiry sent — you can message the agency now.");
    setTab("my-inquiries");
    setTimeout(() => setSuccess(""), 5000);
  }

  async function publishPaidAudition() {
    if (!projectId || !paidAuditionForm.roleId) {
      alert("Link a project with casting roles to publish a paid audition listing.");
      return;
    }
    setPaidAuditionBusy(true);
    try {
      const res = await fetch(`/api/creator/projects/${projectId}/casting/advertise-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: paidAuditionForm.roleId,
          scheduledAt: paidAuditionForm.scheduledAt || null,
          details: paidAuditionForm.details || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not publish audition");
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      setSuccess(`Audition listing published (${formatZar(AUDITION_LISTING_FEE_ZAR)}).`);
      setPaidAuditionForm({ roleId: paidAuditionForm.roleId, scheduledAt: "", details: "" });
      setTimeout(() => setSuccess(""), 5000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPaidAuditionBusy(false);
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
      <BackButton
        fallback={
          projectId ? `/creator/pre/casting-portal?projectId=${encodeURIComponent(projectId)}` : "/creator/dashboard"
        }
      />
      <CreatorProjectContextBanner
        phase="PRE_PRODUCTION"
        toolSlug="casting-portal"
        accent="violet"
        roleHint={selectedRoleId ? "A specific role is selected from the casting portal." : undefined}
      />
      {loadError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-violet-500" />
            Cast & Auditions
          </h1>
          <p className="text-slate-400">
            Your cast repository, find casting agencies and talent, and post auditions.
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
          <button
            onClick={() => setTab("my-inquiries")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "my-inquiries" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white"}`}
          >
            My inquiries ({myInquiries.length})
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

      {tab === "my-inquiries" && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            General inquiries are free. Message casting agencies directly to discuss roles, talent, and availability.
          </p>
          {myInquiries.length === 0 ? (
            <div className="storytime-plan-card p-12 text-center text-slate-500">No inquiries yet. Use Find Cast to message an agency.</div>
          ) : (
            <div className="space-y-3">
              {myInquiries.map((q) => (
                <div key={q.id} className="storytime-plan-card p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{q.agency.agencyName}</p>
                    <p className="text-sm text-slate-400">{q.projectName || "Project"}{q.roleName ? ` · ${q.roleName}` : ""}</p>
                    {q.message && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{q.message}</p>}
                    <p className="text-xs text-slate-500 mt-1">{new Date(q.createdAt).toLocaleString()}</p>
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${q.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-300"}`}>{q.status}</span>
                  </div>
                  <a
                    href={`/creator/messages?tab=cast&castingInquiryId=${q.id}`}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" /> Message
                  </a>
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
                          {agencyDetail.talent.map((t) => {
                            const headshot = t.previewImageUrl || t.headshotUrl;
                            const bioText = t.plainBio || t.profile?.plainBio || t.bio;
                            const rate =
                              t.profile?.dailyRate != null
                                ? `${formatZar(t.profile.dailyRate)}/day`
                                : t.profile?.projectRate != null
                                  ? `${formatZar(t.profile.projectRate)} project`
                                  : null;
                            return (
                            <div key={t.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30 flex gap-4">
                              {headshot ? (
                                <SecureImage fileRef={headshot} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-20 h-20 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                                  <Users className="w-8 h-8 text-slate-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white">{t.name}</p>
                                <div className="flex flex-wrap gap-2 mt-0.5 text-xs">
                                  {(t.ageRange || t.skills) && <span className="text-violet-400">{[t.ageRange, t.skills].filter(Boolean).join(" · ")}</span>}
                                  {t.profile?.experienceLevel && <span className="text-slate-400">{t.profile.experienceLevel}</span>}
                                  {rate && <span className="text-orange-300 font-medium">{rate}</span>}
                                </div>
                                {(t.profile?.location || t.profile?.availability) && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {[t.profile.location, t.profile.availability].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                                {t.profile?.languages && t.profile.languages.length > 0 && (
                                  <p className="text-xs text-slate-500 mt-0.5">Languages: {t.profile.languages.join(", ")}</p>
                                )}
                                {t.profile?.unionStatus && (
                                  <p className="text-xs text-slate-500">Union: {t.profile.unionStatus}</p>
                                )}
                                {(t.profile?.height || t.profile?.eyeColor || t.profile?.hairColor) && (
                                  <p className="text-xs text-slate-500">
                                    {[t.profile.height, t.profile.eyeColor, t.profile.hairColor].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                                {bioText && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bioText}</p>}
                                {t.pastWork && <p className="text-xs text-slate-600 mt-1 line-clamp-1"><span className="text-slate-500">Experience:</span> {t.pastWork}</p>}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {t.cvUrl && <SecureFileLink fileRef={t.cvUrl} label="CV" />}
                                  {t.reelUrl && <SecureFileLink fileRef={t.reelUrl} label="Reel" />}
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
                          );})}
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
          {projectId && projectRoles.length > 0 && (
            <div className="storytime-plan-card p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Publish audition to all agencies</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Broadcast this role from <span className="text-orange-300">{projectTitle || "your project"}</span> to every casting agency on Story Time.
                  Listing fee: <span className="text-orange-300 font-medium">{formatZar(AUDITION_LISTING_FEE_ZAR)}</span>
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={paidAuditionForm.roleId}
                  onChange={(e) => setPaidAuditionForm((f) => ({ ...f, roleId: e.target.value }))}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
                >
                  {projectRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <input
                  placeholder="Audition schedule / callback dates"
                  value={paidAuditionForm.scheduledAt}
                  onChange={(e) => setPaidAuditionForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
                />
              </div>
              <textarea
                placeholder="Role brief, character breakdown, sides availability, callback details…"
                value={paidAuditionForm.details}
                onChange={(e) => setPaidAuditionForm((f) => ({ ...f, details: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none"
                rows={4}
              />
              <button
                type="button"
                disabled={paidAuditionBusy || !paidAuditionForm.roleId}
                onClick={publishPaidAudition}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {paidAuditionBusy ? "Processing…" : `Publish audition (${formatZar(AUDITION_LISTING_FEE_ZAR)})`}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Open call posts</h2>
            <button
              onClick={() => setShowAuditionForm(!showAuditionForm)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 text-sm font-medium"
            >
              <Megaphone className="w-4 h-4" /> Post open call
            </button>
          </div>
          {showAuditionForm && (
            <div className="storytime-plan-card p-4 space-y-3">
              <p className="text-xs text-slate-400">Free open calls appear in the agency audition feed (linked to your content library).</p>
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
                <button onClick={postAudition} disabled={!auditionForm.contentId || !auditionForm.roleName} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-50">
                  Post
                </button>
                <button onClick={() => setShowAuditionForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {auditions.length === 0 ? (
            <div className="storytime-plan-card p-8 text-center text-slate-500">No audition posts yet.</div>
          ) : (
            <div className="space-y-3">
              {auditions.map((a) => (
                <div key={a.id} className="storytime-plan-card p-5 flex items-start justify-between">
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

export default function CreatorCastPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <CreatorCastPageContent />
    </Suspense>
  );
}
