"use client";

import { useState } from "react";

interface StageControlsProps {
  projectId: string;
  status: string;
  phase: string;
}

const NEXT_STAGE: Record<string, { status: string; label: string; phase?: string } | null> = {
  DEVELOPMENT: { status: "PRODUCTION", label: "Move to Production", phase: "SHOOTING" },
  PRODUCTION: { status: "POST_PRODUCTION", label: "Move to Post-Production", phase: "EDITING" },
  POST_PRODUCTION: null,
};

export function ProjectStageControls({ projectId, status, phase }: StageControlsProps) {
  const [updating, setUpdating] = useState(false);
  const next = NEXT_STAGE[status] ?? null;

  if (!next) {
    return (
      <p className="text-xs text-emerald-400">
        This project is already in <span className="font-semibold">{status}</span>. Final delivery
        and distribution happen from the Post-Production tools on the left.
      </p>
    );
  }

  const handleAdvance = async () => {
    try {
      setUpdating(true);
      await fetch(`/api/creator/projects/${projectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.status, phase: next.phase ?? phase }),
      });
      window.location.reload();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-400">
        Current stage is <span className="font-semibold text-slate-200">{status}</span>. When your
        Pre-Production checklist is complete, you can move the project forward.
      </p>
      <button
        type="button"
        onClick={handleAdvance}
        disabled={updating}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
      >
        {updating ? "Updating..." : next.label}
      </button>
    </div>
  );
}

