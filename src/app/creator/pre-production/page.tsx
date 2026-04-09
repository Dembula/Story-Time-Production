"use client";

import { Film, MapPin } from "lucide-react";
import { CreatorPhaseHub } from "@/components/creator/creator-phase-hub";
import { PRE_PRODUCTION_TOOLS } from "@/lib/project-tools";

export default function CreatorPreProductionHub() {
  return (
    <CreatorPhaseHub
      phase="PRE_PRODUCTION"
      eyebrow="Phase 1 — Pre-production"
      title="Pre-Production"
      description="Jump into any pre-production tool for any project. Nothing is locked to a linear flow — you can move between tools and your work follows the project."
      tools={PRE_PRODUCTION_TOOLS}
      sectionProjectsTitle="Choose a project"
      sectionToolsTitle="Jump into a pre-production tool"
      sectionToolsLead="Pick a tool, then open it for a project. Work is saved on that project. Casting, crew, locations, and equipment also offer standalone entry where available."
      ProjectsIcon={Film}
      footerSection={
        <section className="storytime-section space-y-2 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <MapPin className="h-4 w-4 text-sky-400" />
            Crew, cast, locations, equipment &amp; catering
          </h2>
          <p className="text-xs text-slate-500">
            Use the cards above — marketplace tools link to Casting, Crew, Locations, Equipment, and Catering flows. Some open in standalone mode when you have no project yet.
          </p>
        </section>
      }
    />
  );
}
