"use client";



import { Suspense } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";

import ProductionToolPageImpl from "@/app/creator/projects/[projectId]/production/[tool]/page";

import { ProjectContextBarStandalone } from "@/components/creator/project-context-bar";

import { projectToolQueryFn } from "@/lib/project-tool-fetch";



interface ProductionToolStandaloneProps {

  toolSlug: string;

  title: string;

  description: string;

}



function ProductionToolStandaloneContent({

  toolSlug,

}: ProductionToolStandaloneProps) {

  const router = useRouter();

  const searchParams = useSearchParams();

  const pathname = usePathname();

  const projectId = searchParams.get("projectId") ?? "";



  const { data, isLoading } = useQuery({

    queryKey: ["creator-projects"],

    queryFn: projectToolQueryFn("/api/creator/projects"),

  });



  const projects = (data?.projects ?? []) as { id: string; title: string }[];



  const handleProjectChange = (value: string) => {

    if (value) {

      router.push(`/creator/projects/${value}/production/${toolSlug}`);

      return;

    }

    const params = new URLSearchParams(searchParams.toString());

    params.delete("projectId");

    const qs = params.toString();

    router.push(qs ? `${pathname}?${qs}` : pathname);

  };



  return (

    <div className="space-y-4">

      <ProjectContextBarStandalone

        projectId={projectId}

        projects={projects}

        isLoading={isLoading}

        onChange={handleProjectChange}

      />

      <ProductionToolPageImpl params={Promise.resolve({ projectId: projectId || undefined, tool: toolSlug })} />

    </div>

  );

}



export function ProductionToolStandalone(props: ProductionToolStandaloneProps) {

  return (

    <Suspense fallback={<div className="space-y-4 p-4 text-slate-400">Loading…</div>}>

      <ProductionToolStandaloneContent {...props} />

    </Suspense>

  );

}



