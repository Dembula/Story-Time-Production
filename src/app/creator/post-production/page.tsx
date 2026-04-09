"use client";

import Link from "next/link";
import { Clapperboard, Music2, Link2 } from "lucide-react";
import { CreatorPhaseHub } from "@/components/creator/creator-phase-hub";
import { POST_PRODUCTION_HUB_TOOLS } from "@/lib/project-tools";

export default function CreatorPostProductionHub() {
  return (
    <CreatorPhaseHub
      phase="POST_PRODUCTION"
      eyebrow="Phase 3 — Post-production"
      title="Post-Production"
      description="Music and distribution are separate entry points — use Music for the catalogue library, or Distribution for the multi-step catalogue upload. Open either inside a project to keep everything linked to the same film, or start standalone and connect later from My Projects."
      tools={POST_PRODUCTION_HUB_TOOLS}
      sectionProjectsTitle="Choose a project"
      sectionToolsTitle="Jump into a post-production tool"
      sectionToolsLead="Workspace links open the project tool. For distribution, you can also start the catalogue upload flow tied to a project (see “Upload · project” under Distribution)."
      ProjectsIcon={Clapperboard}
      footerSection={
        <section className="storytime-section space-y-4 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Link2 className="h-4 w-4 text-orange-400" />
            Separate flows, one platform
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            This matches how{" "}
            <Link href="/creator/pre-production" className="text-orange-400 hover:text-orange-300">
              Pre-production
            </Link>{" "}
            and{" "}
            <Link href="/creator/production" className="text-orange-400 hover:text-orange-300">
              Production
            </Link>{" "}
            work: you are never forced into a single linear path. Music scoring lives in the{" "}
            <Link href="/creator/music" className="text-orange-400 hover:text-orange-300">
              music hub
            </Link>{" "}
            (library, licensing). Catalogue submission uses the same{" "}
            <Link href="/creator/upload" className="text-orange-400 hover:text-orange-300">
              Catalogue upload
            </Link>{" "}
            wizard as in the sidebar. Open it from a project (workspace Distribution or the{" "}
            <span className="text-slate-400">Upload · …</span> chip) to attach the submission to that film for tracking.
          </p>
          <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Music2 className="h-3.5 w-3.5 text-violet-400" />
            Music only
          </h3>
          <p className="text-xs text-slate-500">
            Use <span className="text-slate-400">Open without project</span> or a workspace chip when you are browsing
            tracks before a project is ready.
          </p>
        </section>
      }
    />
  );
}
