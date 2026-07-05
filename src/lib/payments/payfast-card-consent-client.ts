/** Current browser path + query — use as PayFast card-consent return target. */
export function getClientReturnPath(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  const path = `${window.location.pathname}${window.location.search}`;
  return path.startsWith("/") ? path : fallback;
}

/** Strip card-save callback params after PayFast return. */
export function stripCardSaveQueryParams(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("card_saved");
  params.delete("payment_status");
  params.delete("pr");
  params.delete("reference");
  params.delete("flow");
  const next = params.toString();
  return next ? `?${next}` : "";
}
