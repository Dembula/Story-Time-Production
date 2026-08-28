export type OriginalsChecklistField =
  | "script"
  | "synopsis"
  | "genre"
  | "targetAudience"
  | "references"
  | "directorStatement"
  | "productionCompany"
  | "previousWork"
  | "intendedRelease"
  | "keyCastCrew"
  | "financingStatus"
  | "budgetEstimate";

export const ORIGINALS_CHECKLIST_LABELS: Record<OriginalsChecklistField, string> = {
  script: "Script",
  synopsis: "Synopsis",
  genre: "Genre",
  targetAudience: "Target audience",
  references: "References",
  directorStatement: "Director statement",
  productionCompany: "Production company",
  previousWork: "Previous work",
  intendedRelease: "Intended release",
  keyCastCrew: "Key cast/crew",
  financingStatus: "Financing status",
  budgetEstimate: "Budget estimate",
};

export function buildOriginalsChecklist(input: {
  scriptUrl?: string | null;
  scriptId?: string | null;
  scriptProjectId?: string | null;
  synopsis?: string | null;
  genre?: string | null;
  targetAudience?: string | null;
  references?: string | null;
  directorStatement?: string | null;
  productionCompany?: string | null;
  previousWorkSummary?: string | null;
  intendedRelease?: string | null;
  keyCastCrew?: string | null;
  financingStatus?: string | null;
  budgetEst?: number | string | null;
}): { field: OriginalsChecklistField; label: string; complete: boolean }[] {
  const budget =
    input.budgetEst != null && input.budgetEst !== "" ? Number(input.budgetEst) : 0;
  const checks: Record<OriginalsChecklistField, boolean> = {
    script: !!(input.scriptUrl || input.scriptId || input.scriptProjectId),
    synopsis: !!input.synopsis?.trim(),
    genre: !!input.genre?.trim(),
    targetAudience: !!input.targetAudience?.trim(),
    references: !!input.references?.trim(),
    directorStatement: !!input.directorStatement?.trim(),
    productionCompany: !!input.productionCompany?.trim(),
    previousWork: !!input.previousWorkSummary?.trim(),
    intendedRelease: !!input.intendedRelease?.trim(),
    keyCastCrew: !!input.keyCastCrew?.trim(),
    financingStatus: !!input.financingStatus?.trim(),
    budgetEstimate: Number.isFinite(budget) && budget > 0,
  };
  return (Object.keys(checks) as OriginalsChecklistField[]).map((field) => ({
    field,
    label: ORIGINALS_CHECKLIST_LABELS[field],
    complete: checks[field],
  }));
}
