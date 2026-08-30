/** Shared typed-confirm phrases for destructive creator actions. */

export const CONFIRM_DELETE_PROJECT = "delete project";
export const CONFIRM_DELETE_IDEA = "delete idea";
export const CONFIRM_DELETE_SCRIPT = "delete script";
export const CONFIRM_DELETE_BUDGET = "delete budget";
export const CONFIRM_DELETE_TREATMENT = "delete treatment";
export const CONFIRM_DELETE_SCENE = "delete scene";
export const CONFIRM_DELETE_CASTING_ROLE = "delete role";
export const CONFIRM_DELETE_CREW_NEED = "delete role";
export const CONFIRM_DELETE_SHOOT_DAY = "delete day";
export const CONFIRM_DELETE_TASK = "delete task";
export const CONFIRM_DELETE_TABLE_READ = "delete session";
export const CONFIRM_DELETE_EQUIPMENT = "delete item";
export const CONFIRM_DELETE_CALL_SHEET = "delete sheet";

export function parseDeleteConfirm(
  body: unknown,
  expectedPhrase: string,
): { ok: true } | { ok: false; error: string } {
  const confirm =
    typeof body === "object" && body && "confirm" in body
      ? String((body as { confirm?: unknown }).confirm ?? "").trim().toLowerCase()
      : "";
  const expected = expectedPhrase.trim().toLowerCase();
  if (confirm !== expected) {
    return {
      ok: false,
      error: `Type "${expectedPhrase}" to confirm permanently deleting this.`,
    };
  }
  return { ok: true };
}
