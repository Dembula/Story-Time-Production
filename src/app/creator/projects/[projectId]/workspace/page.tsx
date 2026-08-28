import { redirect } from "next/navigation";
import { creatorProjectWorkspaceHref } from "@/lib/creator-project-href";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

/** Legacy route — production workspace lives on the project overview hub. */
export default async function ProjectWorkspacePage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(creatorProjectWorkspaceHref(projectId));
}
