const RESERVED_HANDLES = new Set([
  "admin",
  "support",
  "help",
  "storytime",
  "modoc",
  "network",
  "creator",
  "creators",
  "official",
  "system",
  "null",
  "undefined",
]);

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

/** Normalize user input to a canonical lowercase handle (no @). */
export function normalizeNetworkHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

export function validateNetworkHandle(handle: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!handle) {
    return { ok: false, error: "Handle cannot be empty. Leave blank to use your email until you choose one." };
  }
  if (handle.length < 3) {
    return { ok: false, error: "Handle must be at least 3 characters." };
  }
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      error: "Use 3–30 characters: lowercase letters, numbers, and underscores only.",
    };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: "That handle is reserved. Try another." };
  }
  return { ok: true, value: handle };
}

/** Parse PATCH body value — empty string clears the handle. */
export function parseNetworkHandleInput(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined) return { ok: false, error: "Handle field missing." };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Handle must be a string." };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalized = normalizeNetworkHandle(trimmed);
  return validateNetworkHandle(normalized);
}
