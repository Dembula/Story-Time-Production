import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "100");
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitParam) ? limitParam : 100));

  const events = await prisma.opsIncident.findMany({
    where: { kind: "password_reset_audit" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      severity: true,
      message: true,
      detail: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    count: events.length,
    events,
  });
}
