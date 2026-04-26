import { hash } from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}
