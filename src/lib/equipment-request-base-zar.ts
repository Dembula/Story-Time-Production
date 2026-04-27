import { parseEmbeddedMeta, type EquipmentMarketMeta } from "./marketplace-profile-meta";

/**
 * Equipment hire base in ZAR from listing embedded meta (`dailyRate`) and request dates.
 * Falls back to a nominal default when rate or dates are missing (mirrors location booking behaviour).
 */
export function computeEquipmentRequestBaseZar(input: {
  equipmentDescription: string | null | undefined;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
}): number {
  const parsed = parseEmbeddedMeta<EquipmentMarketMeta>(input.equipmentDescription ?? null);
  const rate = parsed.meta?.dailyRate ?? 0;
  if (input.startDate && input.endDate && rate > 0) {
    const start = new Date(input.startDate).getTime();
    const end = new Date(input.endDate).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
      return Math.round(days * rate * 100) / 100;
    }
  }
  return rate > 0 ? Math.round(rate * 100) / 100 : 750;
}
