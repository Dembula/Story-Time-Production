"use client";

import { Film, Store } from "lucide-react";
import Link from "next/link";
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
      sectionToolsLead="Use workflow tools for breakdowns, roles, and planning. Hire vendors from the unified Marketplace when you are ready to browse companies and book services."
      ProjectsIcon={Film}
      footerSection={
        <section className="storytime-section space-y-3 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Store className="h-4 w-4 text-orange-400" />
            Production Marketplace
          </h2>
          <p className="text-sm text-slate-400">
            Casting agencies, crew teams, locations, equipment vendors, and catering partners live in one storefront.
            Search companies, link your active project, then open a category for full quotes, messaging, and checkout.
          </p>
          <Link
            href="/creator/marketplace"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-orange-400"
          >
            Open Marketplace
          </Link>
        </section>
      }
    />
  );
}
