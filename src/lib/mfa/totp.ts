import { Secret, TOTP } from "otpauth";
import { randomBytes } from "crypto";
import { hashRecoveryCode } from "@/lib/mfa/crypto";

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function buildOtpauthUri(args: {
  secretBase32: string;
  accountName: string;
  issuer?: string;
}): string {
  const totp = new TOTP({
    issuer: args.issuer || "Story Time",
    label: args.accountName,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(args.secretBase32),
  });
  return totp.toString();
}

export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const totp = new TOTP({
    issuer: "Story Time",
    label: "Story Time",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token: cleaned, window: 1 });
  return delta !== null;
}

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export function hashRecoveryCodes(codes: string[]): string {
  return JSON.stringify(codes.map((c) => hashRecoveryCode(c)));
}

export function consumeRecoveryCode(
  storedJson: string | null | undefined,
  presented: string,
): { ok: boolean; remainingJson: string | null } {
  if (!storedJson) return { ok: false, remainingJson: null };
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(storedJson) as string[];
  } catch {
    return { ok: false, remainingJson: storedJson };
  }
  const target = hashRecoveryCode(presented);
  const idx = hashes.findIndex((h) => h === target);
  if (idx < 0) return { ok: false, remainingJson: storedJson };
  const next = [...hashes.slice(0, idx), ...hashes.slice(idx + 1)];
  return { ok: true, remainingJson: next.length ? JSON.stringify(next) : null };
}

/** Generate a current token (tests / diagnostics only). */
export function currentTotpToken(secretBase32: string): string {
  const totp = new TOTP({
    issuer: "Story Time",
    label: "Story Time",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}
