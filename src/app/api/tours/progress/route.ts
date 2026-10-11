import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TourStatus } from "@/lib/tours/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const db = prisma as any;

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

/** List tour completion / dismissal state for the signed-in user. */
export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const rows = await db.userTourProgress.findMany({
    where: { userId: auth.userId },
    select: { tourId: true, status: true, tourVersion: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    progress: rows.map((r: { tourId: string; status: string; tourVersion: number; updatedAt: Date }) => ({
      tourId: r.tourId,
      status: r.status,
      tourVersion: r.tourVersion,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

/**
 * Upsert progress:
 * { tourId, status: "COMPLETED" | "DISMISSED", tourVersion?: number }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as {
    tourId?: string;
    status?: TourStatus;
    tourVersion?: number;
  } | null;

  const tourId = body?.tourId?.trim();
  const status = body?.status;
  if (!tourId || (status !== "COMPLETED" && status !== "DISMISSED")) {
    return NextResponse.json(
      { error: 'tourId and status ("COMPLETED" | "DISMISSED") are required.' },
      { status: 400 },
    );
  }

  const tourVersion = Math.max(1, Number(body?.tourVersion ?? 1) || 1);

  const row = await db.userTourProgress.upsert({
    where: {
      userId_tourId: { userId: auth.userId, tourId },
    },
    create: {
      userId: auth.userId,
      tourId,
      status,
      tourVersion,
    },
    update: {
      status,
      tourVersion,
    },
    select: { tourId: true, status: true, tourVersion: true, updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    progress: {
      tourId: row.tourId,
      status: row.status,
      tourVersion: row.tourVersion,
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
