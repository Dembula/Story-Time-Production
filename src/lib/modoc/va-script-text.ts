import "server-only";

/** Resolve screenplay text from a project script row. */
export function resolveScriptText(script: {
  currentVersionId: string | null;
  versions: Array<{ id: string; content: string }>;
}): string {
  if (script.currentVersionId) {
    const current = script.versions.find((v) => v.id === script.currentVersionId);
    if (current?.content?.trim()) return current.content;
  }
  return script.versions[0]?.content?.trim() ?? "";
}
