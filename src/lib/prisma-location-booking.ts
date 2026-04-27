import { prisma } from "./prisma";

/**
 * True when Prisma client includes `locationBooking` (after `prisma generate` / `npm run refresh`).
 * Used so list/pay routes return 503 instead of opaque runtime errors when the schema slice is missing.
 */
export function hasLocationBookingModels(): boolean {
  return typeof (prisma as { locationBooking?: unknown }).locationBooking !== "undefined";
}
