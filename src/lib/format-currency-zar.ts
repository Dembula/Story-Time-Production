/** Display amounts as South African Rand (ZAR) across dashboards. */
export function formatZar(
  amount: number,
  opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
): string {
  const max = opts?.maximumFractionDigits ?? 2;
  const min = opts?.minimumFractionDigits ?? 0;
  const n = Number.isFinite(amount) ? amount : 0;
  return `R${n.toLocaleString("en-ZA", { minimumFractionDigits: min, maximumFractionDigits: max })}`;
}
