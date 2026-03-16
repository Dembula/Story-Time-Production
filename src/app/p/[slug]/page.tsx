import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: { slug: string };
}

export default async function PublicProjectWorkspacePage({ params }: PageProps) {
  const link = await prisma.projectWorkspaceLink.findUnique({
    where: { slug: params.slug },
    include: {
      project: true,
    },
  });

  if (!link || !link.project) {
    notFound();
  }

  // Lightweight tracking of visits – do not block render
  prisma.projectWorkspaceLink
    .update({
      where: { id: link.id },
      data: {
        visitCount: { increment: 1 },
        lastVisitedAt: new Date(),
      },
    })
    .catch(() => {
      // best-effort only
    });

  const progressByPhase = await prisma.projectToolProgress.groupBy({
    by: ["phase"],
    where: { projectId: link.projectId },
    _avg: { percent: true },
  });

  const pre = progressByPhase.find((p) => p.phase === "PRE_PRODUCTION")?._avg
    .percent;
  const prod = progressByPhase.find((p) => p.phase === "PRODUCTION")?._avg
    .percent;
  const post = progressByPhase.find((p) => p.phase === "POST_PRODUCTION")?._avg
    .percent;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">
          {link.project.title}
        </h1>
        <p className="text-sm text-slate-400">
          Stage:{" "}
          <span className="font-medium text-slate-200">
            {link.project.status}
          </span>{" "}
          · Phase:{" "}
          <span className="font-medium text-slate-200">
            {link.project.phase}
          </span>
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <PhaseCard label="Pre-Production" value={pre} />
        <PhaseCard label="Production" value={prod} />
        <PhaseCard label="Post-Production" value={post} />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300 space-y-2">
        <p>
          This is a read-only snapshot of the project pipeline. Collaborators can
          see where the film is in Pre-Production, Production, and
          Post-Production without needing access to internal tools.
        </p>
        <p className="text-xs text-slate-500">
          If you are part of the project team, open the editable workspace from
          your Creator dashboard to work inside the tools.
        </p>
      </section>
    </div>
  );
}

function PhaseCard({ label, value }: { label: string; value: number | null | undefined }) {
  const safe = typeof value === "number" ? Math.round(value) : 0;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
        {label}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Completion</span>
        <span className="font-medium text-emerald-400">{safe}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

