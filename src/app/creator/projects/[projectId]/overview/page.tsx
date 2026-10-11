import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProjectStageControls } from "../project-stage-controls";
import { loadProjectUsageSignals } from "@/lib/project-usage-signals";
import {
  buildPipelineRollup,
  resolveToolProgressForProject,
} from "@/lib/project-tool-progress";
import {
  getProjectToolHref,
  POST_PRODUCTION_HUB_TOOLS,
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  type ProjectPhase,
} from "@/lib/project-tools";
import { isActiveProjectMemberStatus } from "@/lib/project-membership";

interface OverviewPageProps {
  params: Promise<{ projectId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  DEVELOPMENT: "Pre-production",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-production",
};

const PHASE_LABELS: Record<string, string> = {
  CONCEPT: "Concept",
  SCRIPT: "Script",
  PREP: "Prep",
  SHOOTING: "Shooting",
  EDITING: "Editing",
  DELIVERY: "Delivery",
};

function humanStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function humanPhase(phase: string): string {
  return PHASE_LABELS[phase] ?? phase.replace(/_/g, " ");
}

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { projectId } = await params;
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
      toolProgress: true,
      ideas: { select: { id: true } },
    },
  });

  if (!project) {
    return null;
  }

  const ideaCountByProject = new Map([[project.id, project.ideas.length]]);
  const signalsMap = await loadProjectUsageSignals([project.id], ideaCountByProject);
  const signals = signalsMap.get(project.id)!;
  const stored = project.toolProgress.map((row) => ({
    toolId: row.toolId,
    phase: row.phase,
    status: row.status,
    percent: row.percent,
  }));
  const resolved = resolveToolProgressForProject({
    projectStatus: project.status,
    stored,
    signals,
    hubToolsOnly: true,
  });
  const rollup = buildPipelineRollup(resolved, project.status);

  const activeMembers = project.members.filter((m) => isActiveProjectMemberStatus(m.status));
  const invitedMembers = project.members.filter((m) => m.status === "INVITED");

  const currentTools =
    rollup.activeStep === 3
      ? POST_PRODUCTION_HUB_TOOLS
      : rollup.activeStep === 2
        ? PRODUCTION_TOOLS
        : PRE_PRODUCTION_TOOLS;

  const quickLinks = currentTools.slice(0, 6).map((t) => ({
    id: t.id,
    label: t.label,
    href: getProjectToolHref(project.id, t as { phase: ProjectPhase; toolSlug: string }),
    status: resolved.find((r) => r.toolId === t.id)?.status ?? "NOT_STARTED",
  }));

  return (
    <div className="space-y-6">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Project workspace
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
          {project.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Pipeline snapshot, team, and quick links into the tools for this film&apos;s current stage.
        </p>
        <div className="mt-4">
          <Link
            href="/creator/dashboard"
            className="text-xs font-medium text-orange-300/90 hover:text-orange-200"
          >
            ← Back to My Projects
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="creator-glass-panel p-4">
          <p className="mb-1 text-xs text-slate-400">Current stage</p>
          <p className="text-lg font-semibold text-white">{humanStatus(project.status)}</p>
          <p className="mt-1 text-[11px] text-slate-500">{project.status}</p>
        </div>
        <div className="creator-glass-panel p-4">
          <p className="mb-1 text-xs text-slate-400">Phase</p>
          <p className="text-lg font-semibold text-white">{humanPhase(project.phase)}</p>
        </div>
        <div className="creator-glass-panel p-4">
          <p className="mb-1 text-xs text-slate-400">Pipeline progress</p>
          <p className="text-lg font-semibold text-white">{rollup.progressPercent}%</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {rollup.completeCount} complete · {rollup.skippedCount} skipped · {rollup.inProgressCount} in
            progress
          </p>
        </div>
        <div className="creator-glass-panel p-4">
          <p className="mb-1 text-xs text-slate-400">Last updated</p>
          <p className="text-lg font-semibold text-white">
            {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(
          [
            ["Pre-production", rollup.phaseSummaries.pre],
            ["Production", rollup.phaseSummaries.prod],
            ["Post-production", rollup.phaseSummaries.post],
          ] as const
        ).map(([label, summary]) => (
          <div key={label} className="creator-glass-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-sm text-slate-200">
              {summary.done}/{summary.total} tools complete
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.inProgress > 0 ? `${summary.inProgress} in progress · ` : ""}
              {summary.skipped > 0 ? `${summary.skipped} skipped` : "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="creator-glass-panel space-y-3 p-4">
        <h3 className="text-sm font-semibold text-white">Production readiness</h3>
        <p className="text-sm text-slate-400">
          Move your film from Pre-Production into Production and then into Post-Production as you complete
          each stage of the pipeline.
        </p>
        <ProjectStageControls
          projectId={project.id}
          status={project.status}
          phase={project.phase}
        />
      </div>

      <div className="creator-glass-panel space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Tools for this stage</h3>
          <Link
            href="/creator/dashboard"
            className="text-xs text-slate-400 hover:text-orange-300"
          >
            Full pipeline on My Projects
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 transition hover:border-orange-500/40 hover:text-white"
            >
              <span className="font-medium">{link.label}</span>
              <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-500">
                {link.status.replace(/_/g, " ").toLowerCase()}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="creator-glass-panel space-y-3 p-4">
        <h3 className="text-sm font-semibold text-white">Collaborators</h3>
        <p className="text-xs text-slate-500">
          {activeMembers.length} on the team
          {invitedMembers.length > 0
            ? ` · ${invitedMembers.length} pending invite${invitedMembers.length !== 1 ? "s" : ""}`
            : ""}
        </p>
        {project.members.length === 0 ? (
          <p className="text-sm text-slate-500">No team members yet. Invite from My Projects.</p>
        ) : (
          <ul className="space-y-2">
            {project.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm"
              >
                <span className="text-slate-200">{m.user?.name ?? "Creator"}</span>
                <span className="text-xs text-slate-500">
                  {m.role}
                  {isActiveProjectMemberStatus(m.status)
                    ? " · On team"
                    : m.status === "INVITED"
                      ? " · Invited"
                      : ` · ${m.status}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
