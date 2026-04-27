import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../generated/prisma";

type EventBody = {
  name?: string;
  path?: string;
  properties?: Record<string, unknown>;
  clientTs?: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: EventBody = {};
  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Event name required" }, { status: 400 });

  await prisma.analyticsEvent.create({
    data: {
      userId,
      role: (session.user as { role?: string }).role ?? null,
      name: name.slice(0, 80),
      path: body.path?.slice(0, 300),
      properties: (body.properties as Prisma.InputJsonValue | undefined) ?? undefined,
      clientTs: body.clientTs ? new Date(body.clientTs) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
