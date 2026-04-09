import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminProjectsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    redirect("/auth/signin");
  }

  const [projects, linkGroups] = await Promise.all([
    prisma.originalProject.findMany({
      include: {
        pitches: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        members: {
          take: 3,
          include: { user: true },
        },
        toolProgress: {
          select: { toolId: true, status: true, phase: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.content.groupBy({
      by: ["linkedProjectId"],
      where: { linkedProjectId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const linkedCatalogueCount: Record<string, number> = {};
  for (const g of linkGroups) {
    if (g.linkedProjectId) linkedCatalogueCount[g.linkedProjectId] = g._count._all;
  }

  return (
    <div className="space-y-6 px-2 md:px-0">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Operations
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Projects &amp; pipeline
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Every creator film project, tool progress snapshot, and how many catalogue submissions are
          linked for delivery tracking.
        </p>
      </header>

      <div className="space-y-3">
        {projects.map((project) => {
          const latestPitch = project.pitches[0];
          const created = new Date(project.createdAt);
          const isOriginal = !!latestPitch;
          const stage = project.status || "DEVELOPMENT";
          const tp = project.toolProgress ?? [];
          const toolsComplete = tp.filter((t) => t.status === "COMPLETE").length;
          const linkedN = linkedCatalogueCount[project.id] ?? 0;

          return (
            <div
              key={project.id}
              id={`project-${project.id}`}
              className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-white truncate">{project.title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {stage}
                  </span>
                  {isOriginal && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/40">
                      Story Time Original
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">
                  {project.logline || "No logline yet."}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Created {created.toLocaleDateString()} · Type {project.type}{" "}
                  {project.genre ? `· ${project.genre}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 text-[11px] text-slate-400 sm:items-end sm:text-right">
                <span>
                  Tools:{" "}
                  <span className="text-slate-200">
                    {toolsComplete}/{tp.length || 0} complete
                  </span>
                </span>
                <span>
                  Linked catalogue:{" "}
                  <span className="text-slate-200">{linkedN}</span>
                </span>
                <span>
                  Team:{" "}
                  {project.members
                    .map((m) => m.user.name || "Member")
                    .slice(0, 2)
                    .join(", ")}
                  {project.members.length > 2 && ` +${project.members.length - 2}`}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5">
                  Phase: {project.phase}
                </span>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <p className="text-sm text-slate-400">
            No projects found yet. When creators submit Originals and use the production pipeline,
            they will appear here.
          </p>
        )}
      </div>
    </div>
  );
}

