import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectWorkspacePage({ params }: PageProps) {
  const { projectId } = await params;
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="creator-glass-panel space-y-4 p-6">
      <p className="text-sm text-slate-300">
        Open any tool for <span className="font-medium text-white">{project.title}</span> from{" "}
        <Link
          href={`/creator/dashboard?openProject=${project.id}`}
          className="text-orange-400 hover:text-orange-300 underline-offset-2 hover:underline"
        >
          My Projects
        </Link>
        . Your work in each tool is saved on this project.
      </p>
    </div>
  );
}
