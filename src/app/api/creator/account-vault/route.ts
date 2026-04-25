import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../generated/prisma";

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    const prev = out[key];
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      prev !== null &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(prev as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.creatorAccountProfileVault.findUnique({
    where: { userId },
  });
  const data =
    row?.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
  if (!body?.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return NextResponse.json({ error: "data object required" }, { status: 400 });
  }

  const existing = await prisma.creatorAccountProfileVault.findUnique({ where: { userId } });
  const prev =
    existing?.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const merged = deepMerge(prev, body.data);

  const row = await prisma.creatorAccountProfileVault.upsert({
    where: { userId },
    create: {
      userId,
      data: merged as Prisma.InputJsonValue,
    },
    update: {
      data: merged as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, data: row.data });
}
