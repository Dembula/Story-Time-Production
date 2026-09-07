export type FinancePeriodKey =
  | "7d"
  | "30d"
  | "mtd"
  | "this_month"
  | "last_month"
  | "ytd"
  | "12m"
  | "all"
  | "custom";

export type FinancePeriodRange = {
  key: FinancePeriodKey;
  label: string;
  periodStart: Date;
  periodEnd: Date;
};

const LABELS: Record<FinancePeriodKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  mtd: "Month to date",
  this_month: "This calendar month",
  last_month: "Last calendar month",
  ytd: "Year to date",
  "12m": "Last 12 months",
  all: "All time",
  custom: "Custom range",
};

export function financePeriodLabel(key: FinancePeriodKey): string {
  return LABELS[key] ?? key;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Parse period query params into an inclusive date range. */
export function resolveFinancePeriodRange(options: {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): FinancePeriodRange {
  const now = options.now ?? new Date();
  const raw = (options.period ?? "mtd").trim().toLowerCase() as FinancePeriodKey;

  if (raw === "custom" || (options.from && options.to)) {
    const from = options.from ? new Date(options.from) : startOfDay(now);
    const to = options.to ? new Date(options.to) : endOfDay(now);
    const periodStart = Number.isFinite(from.getTime()) ? startOfDay(from) : startOfDay(now);
    const periodEnd = Number.isFinite(to.getTime()) ? endOfDay(to) : endOfDay(now);
    return {
      key: "custom",
      label: LABELS.custom,
      periodStart: periodStart <= periodEnd ? periodStart : periodEnd,
      periodEnd: periodStart <= periodEnd ? periodEnd : periodStart,
    };
  }

  if (raw === "7d") {
    const periodEnd = endOfDay(now);
    const periodStart = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { key: "7d", label: LABELS["7d"], periodStart, periodEnd };
  }
  if (raw === "30d") {
    const periodEnd = endOfDay(now);
    const periodStart = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    return { key: "30d", label: LABELS["30d"], periodStart, periodEnd };
  }
  if (raw === "last_month") {
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return {
      key: "last_month",
      label: LABELS.last_month,
      periodStart: new Date(year, month, 1, 0, 0, 0, 0),
      periodEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }
  if (raw === "this_month") {
    return {
      key: "this_month",
      label: LABELS.this_month,
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (raw === "ytd") {
    return {
      key: "ytd",
      label: LABELS.ytd,
      periodStart: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
      periodEnd: endOfDay(now),
    };
  }
  if (raw === "12m") {
    const periodEnd = endOfDay(now);
    const periodStart = startOfDay(new Date(now.getFullYear(), now.getMonth() - 11, now.getDate()));
    return { key: "12m", label: LABELS["12m"], periodStart, periodEnd };
  }
  if (raw === "all") {
    return {
      key: "all",
      label: LABELS.all,
      periodStart: new Date(2000, 0, 1, 0, 0, 0, 0),
      periodEnd: endOfDay(now),
    };
  }

  // mtd default
  return {
    key: "mtd",
    label: LABELS.mtd,
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    periodEnd: endOfDay(now),
  };
}

export const FINANCE_PERIOD_OPTIONS: { key: FinancePeriodKey; label: string }[] = (
  ["7d", "30d", "mtd", "this_month", "last_month", "ytd", "12m", "all"] as FinancePeriodKey[]
).map((key) => ({ key, label: LABELS[key] }));
