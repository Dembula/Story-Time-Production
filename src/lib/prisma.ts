import type { PrismaClient as PrismaClientType } from "../../generated/prisma";

const { PrismaClient } = require("../../generated/prisma") as {
  PrismaClient: new (options?: { log?: string[] }) => any;
};

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType };

export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }) as PrismaClientType);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
