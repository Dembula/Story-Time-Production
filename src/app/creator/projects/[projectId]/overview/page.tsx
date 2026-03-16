import { prisma } from "@/lib/prisma";
import { ProjectStageControls } from "../project-stage-controls";

interface OverviewPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { projectId } = await params;
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Project Overview</h2>
        <p className="text-sm text-slate-400 mt-1">
          High-level snapshot of where this film is in the pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-xs text-slate-400 mb-1">Current Stage</p>
          <p className="text-lg font-semibold text-white">{project.status}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-xs text-slate-400 mb-1">Phase</p>
          <p className="text-lg font-semibold text-white">{project.phase}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-xs text-slate-400 mb-1">Last updated</p>
          <p className="text-lg font-semibold text-white">
            {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Production Readiness</h3>
        <p className="text-sm text-slate-400">
          Move your film from Pre-Production into Production and then into Post-Production as you
          complete each stage of the pipeline.
        </p>
        <ProjectStageControls
          projectId={project.id}
          status={project.status}
          phase={project.phase}
        />
      </div>
    </div>
  );
}

