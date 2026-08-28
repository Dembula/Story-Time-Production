/** Canonical creator production workspace entry (overview hub). */
export function creatorProjectWorkspaceHref(projectId: string): string {
  return `/creator/projects/${projectId}/overview`;
}

/** Admin deep-link to review a creator project dossier. */
export function adminProjectDossierHref(projectId: string): string {
  return `/admin/projects#project-${projectId}`;
}
