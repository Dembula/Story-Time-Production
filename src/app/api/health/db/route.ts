import { NextResponse } from "next/server";
import { ensurePrismaQueryEngineLibrary } from "@/lib/prisma-engine-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight DB + Prisma engine probe for production diagnosis.
 * Does not expose secrets; only ok/error class.
 */
export async function GET() {
  const enginePath = ensurePrismaQueryEngineLibrary();
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      engineResolved: Boolean(enginePath),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database check failed";
    const engineMissing =
      /query engine|rhel-openssl|debian-openssl|PRISMA_QUERY_ENGINE/i.test(message);
    console.error("GET /api/health/db", e);
    return NextResponse.json(
      {
        ok: false,
        engineResolved: Boolean(enginePath),
        code: engineMissing ? "PRISMA_ENGINE" : "DB_ERROR",
        error: engineMissing
          ? "Prisma Query Engine is missing or mismatched for this runtime."
          : "Database query failed.",
      },
      { status: 500 },
    );
  }
}
