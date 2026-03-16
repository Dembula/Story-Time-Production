"use client";

import Link from "next/link";

export interface ProductionToolProps {
  projectId?: string;
}

function requireProjectId(projectId?: string) {
  if (!projectId) {
    return (
      <p className="text-sm text-slate-400">
        Select a project first to use this production tool.
      </p>
    );
  }
  return null;
}

function ToolLink({
  projectId,
  tool,
  label,
}: {
  projectId: string;
  tool:
    | "control-center"
    | "call-sheet-generator"
    | "on-set-tasks"
    | "equipment-tracking"
    | "shoot-progress"
    | "continuity-manager"
    | "dailies-review"
    | "expense-tracker"
    | "incident-reporting"
    | "wrap";
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
      Open this tool in the project workspace.
      <div className="mt-3">
        <Link
          href={`/creator/projects/${projectId}/production/${tool}`}
          className="inline-flex rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
        >
          Open {label}
        </Link>
      </div>
    </div>
  );
}

export function ControlCenterTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Production Control Center
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="control-center" label="Production Control Center" />;
}

export function CallSheetGeneratorTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Call Sheet Generator
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="call-sheet-generator" label="Call Sheet Generator" />;
}

export function OnSetTasksTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            On-Set Task Management
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="on-set-tasks" label="On-Set Task Management" />;
}

export function EquipmentTrackingTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Equipment Tracking
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="equipment-tracking" label="Equipment Tracking" />;
}

export function ShootProgressTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Shoot Progress Tracker
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="shoot-progress" label="Shoot Progress Tracker" />;
}

export function ContinuityManagerTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Continuity Manager
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="continuity-manager" label="Continuity Manager" />;
}

export function DailiesReviewTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">Dailies Review</h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="dailies-review" label="Dailies Review" />;
}

export function ExpenseTrackerTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Production Expense Tracker
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="expense-tracker" label="Production Expense Tracker" />;
}

export function IncidentReportingTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">
            Incident Reporting
          </h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="incident-reporting" label="Incident Reporting" />;
}

export function ProductionWrapTool({ projectId }: ProductionToolProps) {
  const missing = requireProjectId(projectId);
  if (missing) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">Production Wrap</h2>
          {missing}
        </header>
      </div>
    );
  }
  return <ToolLink projectId={projectId!} tool="wrap" label="Production Wrap" />;
}

