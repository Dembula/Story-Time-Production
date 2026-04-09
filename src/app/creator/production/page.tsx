"use client";

import { Camera, AlertTriangle } from "lucide-react";
import { CreatorPhaseHub } from "@/components/creator/creator-phase-hub";
import { PRODUCTION_TOOLS } from "@/lib/project-tools";

export default function CreatorProductionHub() {
  return (
    <CreatorPhaseHub
      phase="PRODUCTION"
      eyebrow="Phase 2 — Production"
      title="Production"
      description="Open any on-set tool for any project. Jump in where it makes sense for your shoot — Story Time keeps the project connected under the hood."
      tools={PRODUCTION_TOOLS}
      sectionProjectsTitle="Active projects"
      sectionToolsTitle="Jump into a production tool"
      sectionToolsLead="Everything you log here is tied to the project you pick and visible in the project workspace."
      ProjectsIcon={Camera}
      footerSection={
        <section className="storytime-section space-y-2 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Staying flexible
          </h2>
          <p className="text-xs text-slate-500">
            You never have to complete tools in order. Jump between call sheets, incidents, and progress tracking — work stays on the same project.
          </p>
        </section>
      }
    />
  );
}
