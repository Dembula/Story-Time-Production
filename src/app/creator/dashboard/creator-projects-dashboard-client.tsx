"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Plus, Users, Clock, Film, ChevronDown, ChevronRight, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  POST_PRODUCTION_HUB_TOOLS,
  getProjectToolHref,
  type ProjectPhase,
} from "@/lib/project-tools";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, formatCreatorLicenseSummary } from "@/lib/pricing";
import { CreatorToolNavCard, type CreatorToolNavStatus } from "@/components/creator/creator-tool-nav-card";
import { setActiveProjectId, sortProjectsWithActiveFirst } from "@/lib/active-project";
import { useActiveProjectId } from "@/hooks/use-active-project";
import { toDisplayStatus } from "@/lib/project-tool-progress";
import { resolveNetworkDisplayName, networkDisplayInitial } from "@/lib/network-display-name";

type ToolProgress = { toolId: string; phase: string; status: string; percent: number };

type ProjectMember = {
  id: string;
  userId: string;
  role: string;
  department?: string | null;
  status: string;
  user?: { id: string; name: string | null; image: string | null };
};

type PhaseSummary = { done: number; skipped: number; inProgress: number; total: number };

type PipelineRollup = {
  activeStep: 1 | 2 | 3;
  totalTracked: number;
  completeCount: number;
  inProgressCount: number;
  skippedCount: number;
  notStartedCount: number;
  progressPercent: number;
  phaseSummaries: Record<"pre" | "prod" | "post", PhaseSummary>;
};

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
  genre: string | null;
  updatedAt: string;
  creatorId?: string | null;
  members: ProjectMember[];
  projectToolProgress?: ToolProgress[];
  pipelineRollup?: PipelineRollup;
  ideasCount?: number;
  isOriginal?: boolean;
};

type NetworkCreator = {
  id: string;
  name: string | null;
  displayName?: string;
  handle?: string | null;
  image: string | null;
  following: boolean;
  connectionStatus?: string;
};

type CollabInviteRow = {
  id: string;
  status: string;
  role: string;
  project: { id: string; title: string };
};

function toolHref(phase: ProjectPhase, toolSlug: string, projectId: string): string {
  return getProjectToolHref(projectId, { phase, toolSlug });
}

const TRACKED_TOOL_IDS = new Set<string>([
  ...PRE_PRODUCTION_TOOLS.map((t) => t.id),
  ...PRODUCTION_TOOLS.map((t) => t.id),
  ...POST_PRODUCTION_HUB_TOOLS.map((t) => t.id),
]);

const ACTIVE_MEMBER_STATUSES = new Set(["ACTIVE", "ACCEPTED"]);

function projectStatusToStep(status: string): 1 | 2 | 3 {
  const s = (status ?? "DEVELOPMENT").toUpperCase();
  if (s === "POST_PRODUCTION") return 3;
  if (s === "PRODUCTION") return 2;
  return 1;
}

function teamCounts(members: ProjectMember[]) {
  const active = members.filter((m) => ACTIVE_MEMBER_STATUSES.has(m.status)).length;
  const invited = members.filter((m) => m.status === "INVITED").length;
  return { active, invited };
}

function memberStatusLabel(status: string): string {
  if (status === "INVITED") return "Invited";
  if (ACTIVE_MEMBER_STATUSES.has(status)) return "On team";
  if (status === "DECLINED") return "Declined";
  return status;
}

function memberStatusStyle(status: string): string {
  if (status === "INVITED") return "border-violet-500/35 bg-violet-500/10 text-violet-200";
  if (ACTIVE_MEMBER_STATUSES.has(status)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "DECLINED") return "border-slate-600/40 bg-slate-800/40 text-slate-500";
  return "border-white/10 bg-white/[0.04] text-slate-400";
}

type ContentListRow = {
  id: string;
  title: string;
  reviewStatus: string;
  linkedProjectId?: string | null;
};

type LinkedCatalogueChip = { id: string; reviewStatus: string; title: string };

function pickLinkedCatalogue(projectId: string, contents: ContentListRow[]): LinkedCatalogueChip | null {
  const tracked = ["PENDING", "REJECTED", "CHANGES_REQUESTED"];
  const rows = contents.filter((c) => c.linkedProjectId === projectId && tracked.includes(c.reviewStatus));
  if (rows.length === 0) return null;
  const rank = (s: string) => (s === "REJECTED" ? 3 : s === "CHANGES_REQUESTED" ? 2 : 1);
  rows.sort((a, b) => rank(b.reviewStatus) - rank(a.reviewStatus));
  const top = rows[0];
  return { id: top.id, reviewStatus: top.reviewStatus, title: top.title };
}

function catalogueChipStyle(status: string): string {
  if (status === "REJECTED") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (status === "CHANGES_REQUESTED") return "border-orange-500/40 bg-orange-500/10 text-orange-200";
  return "border-amber-500/35 bg-amber-500/10 text-amber-100";
}

function catalogueChipLabel(status: string): string {
  if (status === "REJECTED") return "Catalogue rejected";
  if (status === "CHANGES_REQUESTED") return "Catalogue: changes requested";
  return "Catalogue in review";
}

function ProjectRow({
  project,
  defaultOpen = false,
  linkedCatalogue,
  pipelineAccess = true,
  networkCreators,
  meId,
  onInviteCollaborator,
  invitePending,
}: {
  project: Project;
  defaultOpen?: boolean;
  linkedCatalogue: LinkedCatalogueChip | null;
  pipelineAccess?: boolean;
  networkCreators: NetworkCreator[];
  meId?: string;
  onInviteCollaborator: (projectId: string, inviteeUserId: string) => void;
  invitePending: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (defaultOpen && open && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [defaultOpen, open]);
  const progress = project.projectToolProgress ?? [];
  const progressMap = new Map(progress.map((p) => [p.toolId, p]));
  const ideasCount = project.ideasCount ?? 0;
  const rollup = project.pipelineRollup;
  const { active: teamActive, invited: teamInvited } = teamCounts(project.members);

  const updated = new Date(project.updatedAt);
  const stage = project.status || "DEVELOPMENT";
  const activeStep = rollup?.activeStep ?? projectStatusToStep(stage);

  const progressPct = pipelineAccess
    ? rollup?.progressPercent ?? 0
    : progressMap.get("distribution")?.status === "COMPLETE"
      ? 100
      : 0;

  const trackedSummary = rollup
    ? `${rollup.completeCount} complete · ${rollup.skippedCount} skipped · ${rollup.inProgressCount} in progress`
    : `${progress.filter((p) => TRACKED_TOOL_IDS.has(p.toolId) && p.status === "COMPLETE").length} complete`;

  const pre = rollup?.phaseSummaries.pre ?? { done: 0, skipped: 0, inProgress: 0, total: PRE_PRODUCTION_TOOLS.length };
  const prod = rollup?.phaseSummaries.prod ?? { done: 0, skipped: 0, inProgress: 0, total: PRODUCTION_TOOLS.length };
  const post = rollup?.phaseSummaries.post ?? { done: 0, skipped: 0, inProgress: 0, total: POST_PRODUCTION_HUB_TOOLS.length };

  const memberUserIds = new Set(project.members.map((m) => m.userId));
  const inviteCandidates = networkCreators.filter((c) => c.id !== meId && !memberUserIds.has(c.id));
  const canInvite =
    meId &&
    (project.creatorId === meId ||
      project.members.some((m) => m.userId === meId && ACTIVE_MEMBER_STATUSES.has(m.status)));

  const toggleInvitee = (id: string) => {
    setSelectedInvitees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const sendInvites = () => {
    if (!selectedInvitees.length) return;
    for (const inviteeId of selectedInvitees) {
      onInviteCollaborator(project.id, inviteeId);
    }
    setSelectedInvitees([]);
    setInviteMessage("Invites sent — collaborators will see them under My Projects.");
  };

  const renderSection = (
    eyebrow: string,
    title: string,
    stepNum: 1 | 2 | 3,
    phaseSummary: PhaseSummary,
    tools: { id: string; label: string; description: string; toolSlug: string; phase: ProjectPhase }[],
  ) => {
    if (tools.length === 0) return null;
    const isCurrent = activeStep === stepNum;
    return (
      <div
        className={[
          "rounded-2xl border p-5 md:p-6 lg:p-8",
          isCurrent
            ? "border-orange-500/40 bg-orange-500/[0.06] shadow-[0_0_0_1px_rgba(249,115,22,0.12)]"
            : "border-white/10 bg-slate-900/40",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4 mb-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">{eyebrow}</p>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {phaseSummary.done} complete
              {phaseSummary.skipped > 0 ? ` · ${phaseSummary.skipped} skipped` : ""}
              {phaseSummary.inProgress > 0 ? ` · ${phaseSummary.inProgress} in progress` : ""}
              {" · "}
              {phaseSummary.total} tools in this phase
            </p>
          </div>
          {isCurrent ? (
            <span className="shrink-0 rounded-full bg-orange-500/20 px-3 py-1 text-[11px] font-semibold text-orange-200">
              Current phase
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-500">
              Step {stepNum}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {tools.map((t) => {
            const prog = progressMap.get(t.id);
            const resolvedStatus = (prog?.status ?? "NOT_STARTED") as
              | "NOT_STARTED"
              | "IN_PROGRESS"
              | "COMPLETE"
              | "SKIPPED";
            const status: CreatorToolNavStatus = toDisplayStatus(resolvedStatus, t.id, ideasCount);
            const href = toolHref(t.phase, t.toolSlug, project.id);
            return (
              <CreatorToolNavCard
                key={t.id}
                href={href}
                label={t.label}
                description={
                  status === "skipped"
                    ? `${t.description} (not used — project advanced past this phase)`
                    : t.description
                }
                status={status}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const pipelineSteps: { id: 1 | 2 | 3; label: string }[] = [
    { id: 1, label: "Pre-production" },
    { id: 2, label: "Production" },
    { id: 3, label: "Post-production" },
  ];

  return (
    <div ref={rowRef} id={`project-${project.id}`} className="storytime-plan-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.03] md:flex-row md:items-center md:justify-between md:gap-6"
      >
        <div className="min-w-0 flex flex-1 items-start gap-3">
          {open ? <ChevronDown className="mt-1 w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="mt-1 w-5 h-5 text-slate-400 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-semibold text-white md:text-xl">{project.title}</p>
              <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] text-slate-200">{stage}</span>
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400">{project.phase}</span>
              {project.isOriginal && (
                <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-0.5 text-[11px] text-orange-300">
                  Original
                </span>
              )}
              {linkedCatalogue && (
                <Link
                  href={`/creator/catalogue/reviews/${linkedCatalogue.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition hover:brightness-110",
                    catalogueChipStyle(linkedCatalogue.reviewStatus),
                  ].join(" ")}
                >
                  {catalogueChipLabel(linkedCatalogue.reviewStatus)}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-400">
              {project.genre || "Unspecified genre"} · Last edited {updated.toLocaleDateString()}
            </p>
            {/* Stepper aligned with project.status (DEVELOPMENT → PRODUCTION → POST_PRODUCTION) */}
            <div className="flex flex-wrap items-center gap-2">
              {pipelineAccess ? (
                pipelineSteps.map((s, idx) => {
                const reached = activeStep >= s.id;
                const current = activeStep === s.id;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                        current
                          ? "border-orange-500/50 bg-orange-500/15 text-orange-100"
                          : reached
                            ? "border-green-500/30 bg-green-500/10 text-green-300"
                            : "border-white/10 bg-white/[0.03] text-slate-500",
                      ].join(" ")}
                    >
                      {reached && !current ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
                      ) : (
                        <Circle className={`h-3.5 w-3.5 shrink-0 ${current ? "text-orange-400" : "text-slate-600"}`} />
                      )}
                      {s.label}
                    </span>
                    {idx < pipelineSteps.length - 1 && <span className="hidden text-slate-600 sm:inline">→</span>}
                  </div>
                );
              })
              ) : (
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-400">
                  Upload plan — catalogue &amp; distribution only
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {pipelineAccess ? trackedSummary : "No in-app pipeline on your plan"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {teamActive} team member{teamActive !== 1 ? "s" : ""}
                {teamInvited > 0 ? ` · ${teamInvited} invited` : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-48 md:shrink-0">
          <span className="text-xs text-slate-500 md:text-right">
            {open ? "Hide" : "Show"}{" "}
            {pipelineAccess ? "full pipeline" : "distribution"}
          </span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 md:text-right">{progressPct}% overall</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/[0.08] bg-black/25 px-4 py-6 md:px-6 md:py-8 lg:px-10 lg:py-10">
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-400">
            {pipelineAccess ? (
              <>
                Progress reflects tools you&apos;ve used in the workspace and marks earlier-phase tools as{" "}
                <span className="text-slate-300">Skipped</span> when the project advances. Only{" "}
                <span className="text-slate-300">Music &amp; scoring</span> and{" "}
                <span className="text-slate-300">Distribution</span> count in post-production tracking.
              </>
            ) : (
              <>
                Your plan includes linked catalogue submission for this project. Open{" "}
                <span className="text-slate-300">Distribution</span> below, or use{" "}
                <span className="text-slate-300">Catalogue upload</span> in the sidebar.
              </>
            )}
          </p>

          <div className="mb-8 rounded-2xl border border-white/10 bg-slate-900/40 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-300/80">Team</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">Collaborators</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {teamActive} on the team{teamInvited > 0 ? ` · ${teamInvited} pending invite${teamInvited !== 1 ? "s" : ""}` : ""}
                </p>
              </div>
            </div>
            {project.members.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No team members recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {project.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-medium text-slate-300">
                        {m.user?.name?.[0]?.toUpperCase() ?? "C"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{m.user?.name ?? "Creator"}</p>
                        <p className="text-xs text-slate-500">{m.role}{m.department ? ` · ${m.department}` : ""}</p>
                      </div>
                    </div>
                    <span
                      className={[
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        memberStatusStyle(m.status),
                      ].join(" ")}
                    >
                      {memberStatusLabel(m.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {canInvite && (
              <div className="mt-5 border-t border-white/[0.08] pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">Invite collaborators</p>
                <p className="mt-1 text-xs text-slate-500">
                  Send invites to connected creators from your Network. They&apos;ll accept under My Projects.
                </p>
                {inviteCandidates.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-white/12 px-3 py-2 text-[11px] text-slate-500">
                    No new creators to invite — connect with creators on Network first, or everyone listed is already on this project.
                  </p>
                ) : (
                  <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/8 bg-black/12 px-2 py-2">
                    {inviteCandidates.map((c) => {
                      const active = selectedInvitees.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleInvitee(c.id)}
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition",
                            active
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                              : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/18",
                          ].join(" ")}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px]">
                            {networkDisplayInitial(c)}
                          </span>
                          <span className="max-w-[120px] truncate">
                            {c.displayName ?? resolveNetworkDisplayName(c)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedInvitees.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" disabled={invitePending} onClick={sendInvites}>
                      {invitePending ? "Sending…" : `Send ${selectedInvitees.length} invite${selectedInvitees.length !== 1 ? "s" : ""}`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-slate-400"
                      onClick={() => setSelectedInvitees([])}
                    >
                      Clear
                    </Button>
                  </div>
                )}
                {inviteMessage ? <p className="mt-2 text-xs text-emerald-300/90">{inviteMessage}</p> : null}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8 lg:gap-10">
            {pipelineAccess ? (
              <>
                {renderSection("Phase 1", "Pre-production", 1, pre, PRE_PRODUCTION_TOOLS.map((t) => ({
                  id: t.id,
                  label: t.label,
                  description: t.description,
                  toolSlug: t.toolSlug,
                  phase: t.phase,
                })))}
                {renderSection("Phase 2", "Production", 2, prod, PRODUCTION_TOOLS.map((t) => ({
                  id: t.id,
                  label: t.label,
                  description: t.description,
                  toolSlug: t.toolSlug,
                  phase: t.phase,
                })))}
                {renderSection(
                  "Phase 3",
                  "Post-production",
                  3,
                  post,
                  POST_PRODUCTION_HUB_TOOLS.map((t) => ({
                    id: t.id,
                    label: t.label,
                    description: t.description,
                    toolSlug: t.toolSlug,
                    phase: t.phase,
                  })),
                )}
              </>
            ) : (
              renderSection(
                "Distribution",
                "Catalogue & linked delivery",
                3,
                {
                  done: progressMap.get("distribution")?.status === "COMPLETE" ? 1 : 0,
                  skipped: 0,
                  inProgress: 0,
                  total: 1,
                },
                POST_PRODUCTION_HUB_TOOLS.filter((t) => t.toolSlug === "distribution").map((t) => ({
                  id: t.id,
                  label: t.label,
                  description: t.description,
                  toolSlug: t.toolSlug,
                  phase: t.phase,
                })),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreatorProjectsDashboardClient() {
  const searchParams = useSearchParams();
  const openProjectId = searchParams.get("openProject");
  const showPipelineUpgrade = searchParams.get("upgrade") === "pipeline";
  const queryClient = useQueryClient();

  useEffect(() => {
    if (openProjectId) setActiveProjectId(openProjectId);
  }, [openProjectId]);
  const { data: licensePayload } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const pipelineAccess = Boolean(licensePayload?.pipelineAccess);
  const planSummary =
    typeof licensePayload?.planSummary === "string" && licensePayload.planSummary
      ? licensePayload.planSummary
      : licensePayload?.license
        ? formatCreatorLicenseSummary(licensePayload.license.type)
        : "";

  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const { data: collabInvitesRaw, refetch: refetchCollabInvites } = useQuery({
    queryKey: ["creator-collab-invites"],
    queryFn: () => fetch("/api/originals?type=my-projects").then((r) => (r.ok ? r.json() : [])),
  });
  const collabInvites: CollabInviteRow[] = Array.isArray(collabInvitesRaw)
    ? collabInvitesRaw.filter((m: CollabInviteRow) => m.status === "INVITED")
    : [];

  const respondInviteMutation = useMutation({
    mutationFn: async ({ memberId, accept }: { memberId: string; accept: boolean }) => {
      const res = await fetch("/api/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESPOND_INVITE", memberId, accept }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      refetchCollabInvites();
      queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
    },
  });

  const { data: contentListRaw } = useQuery({
    queryKey: ["creator-content-dashboard"],
    queryFn: () => fetch("/api/creator/content").then((r) => r.json()),
  });
  const contents: ContentListRow[] = Array.isArray(contentListRaw) ? contentListRaw : [];

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("FEATURE_FILM");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("");
  const [isStoryTimeOriginal, setIsStoryTimeOriginal] = useState(false);
  const [isCollaboration, setIsCollaboration] = useState(false);
  const [networkCreators, setNetworkCreators] = useState<NetworkCreator[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);

  const inviteCollaboratorMutation = useMutation({
    mutationFn: async ({ projectId, inviteeUserId }: { projectId: string; inviteeUserId: string }) => {
      const res = await fetch("/api/network/invite-to-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, inviteeUserId, role: "Collaborator" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
    },
  });

  const handleInviteCollaborator = (projectId: string, inviteeUserId: string) => {
    inviteCollaboratorMutation.mutate({ projectId, inviteeUserId });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          logline,
          genre,
          isOriginal: isStoryTimeOriginal,
          isCollaboration,
          collaboratorIds: isCollaboration ? selectedCollaborators : [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: (result: { project?: { id?: string } }) => {
      const newId = result?.project?.id;
      if (newId) {
        // Newest project becomes the default selection across all tools.
        setActiveProjectId(newId);
      }
      setCreating(false);
      setTitle("");
      setLogline("");
      setGenre("");
      setIsCollaboration(false);
      setSelectedCollaborators([]);
      queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
    },
  });

  const activeProjectId = useActiveProjectId();
  const projects: Project[] = sortProjectsWithActiveFirst(data?.projects ?? [], activeProjectId);
  const meId: string | undefined = data?.meId;

  useEffect(() => {
    fetch("/api/network/creators")
      .then((r) => r.json())
      .then((d) => {
        const all: NetworkCreator[] = d.creators ?? [];
        const connected = all.filter(
          (c) => (c.following || c.connectionStatus === "ACCEPTED") && c.id !== meId,
        );
        setNetworkCreators(connected);
      })
      .catch(() => setNetworkCreators([]));
  }, [meId]);

  useEffect(() => {
    if (!creating || !isCollaboration) return;
    fetch("/api/network/creators")
      .then((r) => r.json())
      .then((d) => {
        const all: NetworkCreator[] = d.creators ?? [];
        const connected = all.filter(
          (c) => (c.following || c.connectionStatus === "ACCEPTED") && c.id !== meId,
        );
        setNetworkCreators(connected);
      })
      .catch(() => setNetworkCreators([]));
  }, [creating, isCollaboration, meId]);

  const toggleCollaborator = (id: string) => {
    setSelectedCollaborators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-10">
      <header className="storytime-plan-card p-5 md:p-6 lg:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
                {pipelineAccess ? "Creator pipeline" : "My projects & catalogue"}
              </p>
              {planSummary ? (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
                  {planSummary}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">My Projects</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
              {pipelineAccess ? (
                <>
                  Same rhythm as Distribution upload: one clear flow per project. Expand a film to see all three phases in
                  a vertical stack — progress counts only tools we ship (including Music + Distribution in post).
                </>
              ) : (
                <>
                  Use projects to organise titles and link catalogue submissions. Pre-production, production, and
                  post-production tools are not on your plan — upgrade to the full pipeline to unlock them everywhere.
                </>
              )}
            </p>
            {showPipelineUpgrade && !pipelineAccess ? (
              <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                That area requires the <strong className="text-white">full pipeline</strong> plan. Contact support to
                switch plans, or use a new account and choose pipeline access during onboarding.
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2 self-start sm:flex-row sm:items-center md:self-center">
            <Link
              href="/creator/upload"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-orange-400/35 hover:bg-orange-500/10 hover:text-white"
            >
              Catalogue upload
            </Link>
            <Button onClick={() => setCreating(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
        </div>
      </header>

      {collabInvites.length > 0 && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/25 px-4 py-4 md:px-5">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-200/90">Collaboration invites</p>
          <p className="mt-1 text-sm text-slate-300">
            Creators you connected with on Network can invite you onto a project. Accept to join the team.
          </p>
          <ul className="mt-3 space-y-2">
            {collabInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{inv.project.title}</p>
                  <p className="text-xs text-slate-400">Role: {inv.role}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600"
                    disabled={respondInviteMutation.isPending}
                    onClick={() => respondInviteMutation.mutate({ memberId: inv.id, accept: false })}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-500"
                    disabled={respondInviteMutation.isPending}
                    onClick={() => respondInviteMutation.mutate({ memberId: inv.id, accept: true })}
                  >
                    Accept
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Create a new film project</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Working title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="e.g. The Last Light"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="storytime-select rounded-xl px-3 py-2"
              >
                <option value="SHORT_FILM">Short film</option>
                <option value="INDIE_FILM">Indie film</option>
                <option value="FEATURE_FILM">Feature film</option>
                <option value="TV_EPISODE">TV episode</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Logline</label>
              <input
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="One sentence that sells your film."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Genre</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="Drama, Sci-Fi, Thriller..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Story Time Originals program</label>
              <button
                type="button"
                onClick={() => setIsStoryTimeOriginal((v) => !v)}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition",
                  isStoryTimeOriginal
                    ? "bg-orange-500/10 border-orange-500 text-orange-300"
                    : "bg-white/[0.03] border-white/10 text-slate-300",
                ].join(" ")}
              >
                {isStoryTimeOriginal ? "Applying for Originals" : "Standard film project"}
              </button>
              <p className="text-[11px] text-slate-500">
                Only enable if you are submitting this title to the Story Time Originals greenlight program.
                Regular catalogue films should stay off.
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Collaboration</label>
              <button
                type="button"
                onClick={() => setIsCollaboration((v) => !v)}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition",
                  isCollaboration
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                    : "bg-white/[0.03] border-white/10 text-slate-300",
                ].join(" ")}
              >
                <span className="w-2 h-2 rounded-full border border-slate-500 bg-slate-900">
                  <span
                    className={[
                      "block w-full h-full rounded-full transition",
                      isCollaboration ? "bg-emerald-400" : "bg-transparent",
                    ].join(" ")}
                  />
                </span>
                {isCollaboration ? "Collaboration project" : "Solo project (you can still invite later)"}
              </button>
              <p className="text-[11px] text-slate-500">
                Mark this as a collaboration to make it easier to invite creators you follow from the Network to work on the film with you.
              </p>
            </div>
            {isCollaboration && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-400">
                  Add collaborators from your network
                </label>
                {networkCreators.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/12 px-3 py-2 text-[11px] text-slate-500">
                    You don&apos;t have any connected creators yet. Use the Network tab to follow
                    and connect with other creators – once a connection is accepted, you&apos;ll be
                    able to invite them here.
                  </p>
                ) : (
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/8 bg-black/12 px-2 py-2">
                    {networkCreators.map((c) => {
                      const active = selectedCollaborators.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCollaborator(c.id)}
                          className={[
                            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs border transition",
                            active
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                              : "bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/18",
                          ].join(" ")}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px]">
                            {networkDisplayInitial(c)}
                          </span>
                          <span className="max-w-[120px] truncate">
                            {c.displayName ?? resolveNetworkDisplayName(c)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="border-white/10 text-slate-300"
              onClick={() => {
                setCreating(false);
                setTitle("");
                setLogline("");
                setGenre("");
              }}
            >
              Cancel
            </Button>
            <Button disabled={!title || !type || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating..." : "Create project"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="storytime-empty-state p-8 text-center">
          <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-200 font-medium mb-1">No projects yet</p>
          <p className="text-sm text-slate-400 mb-4">
            {pipelineAccess
              ? "Create your first film project to start using the full production pipeline."
              : "Create a project to link catalogue uploads and Originals to a single title."}
          </p>
          <Button onClick={() => setCreating(true)} className="mx-auto flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              defaultOpen={project.id === openProjectId}
              linkedCatalogue={pickLinkedCatalogue(project.id, contents)}
              pipelineAccess={pipelineAccess}
              networkCreators={networkCreators}
              meId={meId}
              onInviteCollaborator={handleInviteCollaborator}
              invitePending={inviteCollaboratorMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

