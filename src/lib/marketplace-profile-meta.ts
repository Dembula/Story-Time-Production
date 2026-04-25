const MARKET_META_START = "[ST_MARKET_META]";
const MARKET_META_END = "[/ST_MARKET_META]";

export type AccountStructure = "INDIVIDUAL" | "COMPANY";

export type ActorMarketMeta = {
  location?: string | null;
  languages?: string[];
  experienceLevel?: string | null;
  dailyRate?: number | null;
  projectRate?: number | null;
  availability?: string | null;
  contactVisibility?: "PRIVATE" | "PUBLIC";
};

export type CrewMarketMeta = {
  role?: string | null;
  department?: string | null;
  experienceLevel?: string | null;
  dailyRate?: number | null;
  availability?: string | null;
  location?: string | null;
  tools?: string[];
  accountStructure?: AccountStructure | null;
};

export type LocationMarketMeta = {
  hourlyRate?: number | null;
  dailyRate?: number | null;
  permitRequired?: boolean;
  permitNotes?: string | null;
  restrictions?: string | null;
  logistics?: string | null;
  availability?: string | null;
};

export type EquipmentMarketMeta = {
  specifications?: string | null;
  dailyRate?: number | null;
  quantityAvailable?: number | null;
  availability?: string | null;
};

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function parseEmbeddedMeta<T>(text: string | null | undefined): {
  plain: string | null;
  meta: T | null;
} {
  const source = (text ?? "").trim();
  if (!source) return { plain: null, meta: null };

  const start = source.indexOf(MARKET_META_START);
  const end = source.indexOf(MARKET_META_END);
  if (start === -1 || end === -1 || end <= start) {
    return { plain: source, meta: null };
  }

  const payload = source.slice(start + MARKET_META_START.length, end).trim();
  const before = source.slice(0, start).trim();
  const after = source.slice(end + MARKET_META_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim() || null;
  return { plain, meta: safeJsonParse<T>(payload) };
}

export function embedMeta<T extends Record<string, unknown>>(
  plainText: string | null | undefined,
  meta: T | null | undefined,
): string | null {
  const plain = (plainText ?? "").trim();
  const hasMeta = !!meta && Object.values(meta).some((v) => v !== null && v !== undefined && `${v}` !== "");
  if (!hasMeta) return plain || null;

  const out = `${MARKET_META_START}\n${JSON.stringify(meta)}\n${MARKET_META_END}`;
  return plain ? `${plain}\n\n${out}` : out;
}

export function listIncludes(listText: string | null | undefined, query: string | null | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (listText ?? "")
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((item) => item.includes(needle));
}
