"use client";

import {
  ControlCenter,
  CallSheetGenerator,
  OnSetTasks,
  EquipmentTracking,
  ShootProgress,
  ContinuityManager,
  DailiesReview,
  ExpenseTracker,
  IncidentReporting,
  ProductionWrap,
} from "@/app/creator/projects/[projectId]/production/[tool]/page";

export interface ProductionToolProps {
  projectId?: string;
}

function requireProjectId(projectId?: string) {
  // #region agent log
  fetch("http://127.0.0.1:7661/ingest/e765b01c-cec5-485d-8f2c-447ed6fafc98", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "d1fe7d",
    },
    body: JSON.stringify({
      sessionId: "d1fe7d",
      runId: "pre-fix",
      hypothesisId: "H2",
      location: "ProductionTools.tsx:line20",
      message: "requireProjectId check",
      data: { hasProjectId: !!projectId },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (!projectId) {
    return (
      <p className="text-sm text-slate-400">
        Select a project first to use this production tool.
      </p>
    );
  }
  return null;
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
  return (
    <ControlCenter projectId={projectId!} title="Production Control Center" />
  );
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
  return (
    <CallSheetGenerator
      projectId={projectId!}
      title="Call Sheet Generator"
    />
  );
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
  return (
    <OnSetTasks projectId={projectId!} title="On-Set Task Management" />
  );
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
  return (
    <EquipmentTracking projectId={projectId!} title="Equipment Tracking" />
  );
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
  return (
    <ShootProgress projectId={projectId!} title="Shoot Progress Tracker" />
  );
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
  return (
    <ContinuityManager projectId={projectId!} title="Continuity Manager" />
  );
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
  return <DailiesReview projectId={projectId!} title="Dailies Review" />;
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
  return (
    <ExpenseTracker
      projectId={projectId!}
      title="Production Expense Tracker"
    />
  );
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
  return (
    <IncidentReporting projectId={projectId!} title="Incident Reporting" />
  );
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
  return (
    <ProductionWrap projectId={projectId!} title="Production Wrap" />
  );
}

