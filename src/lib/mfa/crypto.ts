import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";

const PREFIX = "v1:";

function encryptionKey(): Buffer {
  const secret = process.env.MFA_ENCRYPTION_KEY?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET (or MFA_ENCRYPTION_KEY) is required to store MFA secrets.");
  }
  return scryptSync(secret, "story-time-mfa-v1", 32);
}

export function encryptMfaSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptMfaSecret(payload: string): string {
  if (!payload.startsWith(PREFIX)) throw new Error("Unsupported MFA secret format.");
  const [ivB64, tagB64, dataB64] = payload.slice(PREFIX.length).split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Corrupt MFA secret.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`st-mfa-recovery:${code.trim().toUpperCase()}`).digest("hex");
}
