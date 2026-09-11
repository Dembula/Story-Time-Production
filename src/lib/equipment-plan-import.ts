export type ParsedEquipmentPlanRow = {
  category: string;
  quantity: number;
  description: string | null;
};

const QTY_PREFIX = /^\s*(?:(\d+)\s*[x×]\s*|qty[:\s]*(\d+)\s*[-–—:]?\s*)(.+)$/i;
const QTY_SUFFIX = /^(.+?)(?:\s*[·|,;-]\s*|\s+)(?:qty[:\s]*)?(\d+)\s*$/i;
const CSV_HEADER = /^(category|item|equipment|name)\b/i;

function cleanCell(value: string): string {
  return value.replace(/^["']|["']$/g, "").replace(/\s+/g, " ").trim();
}

function clampQty(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(9999, Math.round(n));
}

/** Parse one free-text equipment line into category + quantity. */
export function parseEquipmentPlanLine(rawLine: string): ParsedEquipmentPlanRow | null {
  const line = rawLine.replace(/\u00a0/g, " ").trim();
  if (!line || line.length < 2) return null;
  if (/^(-{2,}|={2,}|\*{2,}|#{1,6}\s)/.test(line)) return null;
  if (/^(equipment|gear|kit|item|category|qty|quantity)\s*(list|plan)?\s*:?\s*$/i.test(line)) return null;
  if (CSV_HEADER.test(line) && /quantity|qty|description/i.test(line)) return null;

  // CSV-ish: category,qty,description
  if (line.includes(",")) {
    const parts = line.split(",").map(cleanCell).filter(Boolean);
    if (parts.length >= 2) {
      const qtyFromSecond = Number(parts[1]);
      if (Number.isFinite(qtyFromSecond)) {
        return {
          category: parts[0].slice(0, 160),
          quantity: clampQty(qtyFromSecond),
          description: parts.slice(2).join(", ").slice(0, 500) || null,
        };
      }
      // category, description, qty at end
      const last = Number(parts[parts.length - 1]);
      if (Number.isFinite(last) && parts.length >= 2) {
        return {
          category: parts[0].slice(0, 160),
          quantity: clampQty(last),
          description: parts.slice(1, -1).join(", ").slice(0, 500) || null,
        };
      }
    }
  }

  const tabParts = line.split("\t").map(cleanCell).filter(Boolean);
  if (tabParts.length >= 2) {
    const qty = Number(tabParts[1]);
    if (Number.isFinite(qty)) {
      return {
        category: tabParts[0].slice(0, 160),
        quantity: clampQty(qty),
        description: tabParts.slice(2).join(" ").slice(0, 500) || null,
      };
    }
  }

  const prefix = line.match(QTY_PREFIX);
  if (prefix) {
    const qty = Number(prefix[1] || prefix[2] || "1");
    const rest = cleanCell(prefix[3] || "");
    if (rest) {
      return { category: rest.slice(0, 160), quantity: clampQty(qty), description: null };
    }
  }

  const suffix = line.match(QTY_SUFFIX);
  if (suffix) {
    const rest = cleanCell(suffix[1] || "");
    const qty = Number(suffix[2] || "1");
    if (rest && rest.length >= 2) {
      return { category: rest.slice(0, 160), quantity: clampQty(qty), description: null };
    }
  }

  // Plain item name → qty 1
  if (/[A-Za-z]/.test(line)) {
    return { category: cleanCell(line).slice(0, 160), quantity: 1, description: null };
  }
  return null;
}

export function parseEquipmentPlanText(text: string): ParsedEquipmentPlanRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: ParsedEquipmentPlanRow[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const parsed = parseEquipmentPlanLine(raw);
    if (!parsed) continue;
    const key = `${parsed.category.toLowerCase()}|${parsed.quantity}|${parsed.description ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(parsed);
    if (rows.length >= 500) break;
  }

  return rows;
}
