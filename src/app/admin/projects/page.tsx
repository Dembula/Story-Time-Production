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

  const projects = await prisma.originalProject.findMany({
    include: {
      pitches: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      members: {
        take: 3,
        include: { user: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
          Projects & Pipeline
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          High-level view of all Originals and creator film projects across Pre-Production,
          Production, and Post-Production.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
        This overview surfaces projects from the Originals system (`OriginalProject`). As you add
        more pipeline data (budgets, schedules, contracts), this page can be extended to show
        readiness, risks, and assignment across the admin team.
      </div>

      <div className="space-y-3">
        {projects.map((project) => {
          const latestPitch = project.pitches[0];
          const created = new Date(project.createdAt);
          const isOriginal = !!latestPitch;
          const stage = project.status || "DEVELOPMENT";

          return (
            <div
              key={project.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
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
              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400 w-40">
                <span className="self-end">
                  Team:{" "}
                  {project.members
                    .map((m) => m.user.name || "Member")
                    .slice(0, 2)
                    .join(", ")}
                  {project.members.length > 2 && ` +${project.members.length - 2}`}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
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

