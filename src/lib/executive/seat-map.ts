/**
 * Canonical executive seat map (edge-safe — no DB).
 * Must stay in sync with ExecutiveSeat seed rows.
 *
 * Executive suite lives inside the admin shell at /admin/executive/*.
 */
export const EXECUTIVE_OFFICES = ["CEO", "COO", "CMO", "CFO", "CIO"] as const;
export type ExecutiveOffice = (typeof EXECUTIVE_OFFICES)[number];

export const EXECUTIVE_SEAT_EMAILS: Record<string, ExecutiveOffice> = {
  "lungelonomvete@gmail.com": "CEO",
  "ngwenyatholwana45@gmail.com": "COO",
  "sabelonomvete@icloud.com": "CMO",
  "mzamomalizo@gmail.com": "CFO",
  "acenomvete@icloud.com": "CIO",
  // Temporary QA seats — remove after testing (do not replace production C-suite emails above)
  "temp.ceo@story-time.test": "CEO",
  "temp.coo@story-time.test": "COO",
  "temp.cmo@story-time.test": "CMO",
  "temp.cfo@story-time.test": "CFO",
  "temp.cio@story-time.test": "CIO",
};

/** Temporary executive QA accounts (delete when testing is done). */
export const TEMP_EXECUTIVE_QA_EMAILS = [
  "temp.ceo@story-time.test",
  "temp.coo@story-time.test",
  "temp.cmo@story-time.test",
  "temp.cfo@story-time.test",
  "temp.cio@story-time.test",
] as const;

export const EXECUTIVE_OFFICE_QUESTIONS: Record<ExecutiveOffice, string> = {
  CEO: "Is the company healthy and growing?",
  COO: "Is Story Time's content and operation running properly?",
  CMO: "Are we acquiring, engaging and retaining viewers?",
  CFO: "Is the Story Time economy financially healthy?",
  CIO: "Is the technology healthy, secure, scalable and efficient?",
};

export const EXECUTIVE_OFFICE_BLURBS: Record<ExecutiveOffice, string> = {
  CEO: "Company health, growth trajectory, and leadership priorities.",
  COO: "Content pipeline, encoding fleet, and day-to-day operations.",
  CMO: "Acquisition, engagement, retention, and product event signals.",
  CFO: "Pools, treasury, payment health, and Story Time economics.",
  CIO: "Platform reliability, AI observability, and encode/infra risk.",
};

export function normalizeExecutiveEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export function officeFromEmail(email: string | null | undefined): ExecutiveOffice | null {
  const normalized = normalizeExecutiveEmail(email);
  if (!normalized) return null;
  return EXECUTIVE_SEAT_EMAILS[normalized] ?? null;
}

export function executiveHomePath(office: ExecutiveOffice): string {
  return `/admin/executive/${office.toLowerCase()}`;
}

export function parseExecutiveOfficeParam(value: string | null | undefined): ExecutiveOffice | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (EXECUTIVE_OFFICES as readonly string[]).includes(upper) ? (upper as ExecutiveOffice) : null;
}

export function officeFromExecutivePath(path: string | null | undefined): ExecutiveOffice | null {
  if (!path) return null;
  const match = path.match(/\/(?:admin\/)?executive\/(ceo|coo|cmo|cfo|cio)(?:\/|$)/i);
  if (!match?.[1]) return null;
  return parseExecutiveOfficeParam(match[1]);
}

export function isExecutivePath(path: string | null | undefined): boolean {
  if (!path) return false;
  return (
    path === "/executive" ||
    path.startsWith("/executive/") ||
    path === "/admin/executive" ||
    path.startsWith("/admin/executive/") ||
    path.startsWith("/api/executive")
  );
}

/** Legacy portal paths → admin-nested suite. */
export function migrateLegacyExecutivePath(path: string): string | null {
  if (path === "/executive" || path === "/executive/") return "/admin/executive";
  const match = path.match(/^\/executive(\/.*)?$/i);
  if (!match) return null;
  return `/admin/executive${match[1] ?? ""}`;
}
