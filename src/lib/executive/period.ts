import { getCalendarMonthToDateRange } from "@/lib/financial-ledger";

export type ExecutivePeriod = {
  start: Date;
  end: Date;
  key: string;
  label: string;
};

export function currentExecutivePeriod(now = new Date()): ExecutivePeriod {
  const { periodStart, periodEnd } = getCalendarMonthToDateRange(now);
  const key = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
  return {
    start: periodStart,
    end: periodEnd,
    key,
    label: `MTD ${key}`,
  };
}

export function previousCalendarMonthPeriod(now = new Date()): ExecutivePeriod {
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const monthIndex = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return { start, end, key, label: `Prior ${key}` };
}
