import { compare, hash } from "bcryptjs";

const PIN_LENGTH = 4;

export function normalizeProfilePin(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateProfilePin(pin: string): string | null {
  const digits = normalizeProfilePin(pin);
  if (digits.length !== PIN_LENGTH) {
    return `PIN must be exactly ${PIN_LENGTH} digits`;
  }
  return null;
}

export async function hashProfilePin(pin: string): Promise<string> {
  const digits = normalizeProfilePin(pin);
  const validationError = validateProfilePin(digits);
  if (validationError) throw new Error(validationError);
  return hash(digits, 10);
}

export async function verifyProfilePin(pin: string, pinHash: string | null | undefined): Promise<boolean> {
  if (!pinHash) return false;
  const digits = normalizeProfilePin(pin);
  if (validateProfilePin(digits)) return false;
  return compare(digits, pinHash);
}
