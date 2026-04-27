/**
 * Parse EMAIL_FROM for APIs that require a bare `email` (SendGrid v3 JSON)
 * vs a full RFC string (some SDK paths accept "Name <email>").
 */
export function parseAppMailFrom(raw?: string | null): { email: string; name?: string } {
  const s = (raw ?? process.env.EMAIL_FROM ?? "noreply@storytime.com").trim();
  const angle = s.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    const email = angle[2].trim();
    if (email.includes("@")) {
      return { email, ...(name ? { name } : {}) };
    }
  }
  if (s.includes("@") && !s.includes("<")) {
    return { email: s };
  }
  return { email: "noreply@storytime.com" };
}

export function formatAppMailFromHeader(parsed: { email: string; name?: string }): string {
  return parsed.name ? `${parsed.name} <${parsed.email}>` : parsed.email;
}
