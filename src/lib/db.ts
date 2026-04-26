import { prisma } from "@/lib/prisma";

/**
 * Central DB entry-point. Prisma is connected to Neon via DATABASE_URL.
 */
export { prisma as db };
