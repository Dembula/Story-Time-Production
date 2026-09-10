import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function getKey(): Buffer {
  const raw = process.env.EXEC_COMMS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "story-time-exec-comms-dev-key";
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM encrypt plaintext for executive messages at rest. */
export function encryptExecutiveMessage(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptExecutiveMessage(ciphertextB64: string, ivB64: string): string {
  const buf = Buffer.from(ciphertextB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
