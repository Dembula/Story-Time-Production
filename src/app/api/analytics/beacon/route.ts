import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../generated/prisma";
import { isPublicAnalyticsEventName } from "@/lib/analytics-beacon";

type BeaconBody = {
  name?: string;
  path?: string;
  properties?: Record<string, unknown>;
  clientTs?: string;
};

const hitsByIp = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;

function allowIp(ip: string): boolean {
  const now = Date.now();
  const row = hitsByIp.get(ip);
  if (!row || row.resetAt < now) {
    hitsByIp.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (row.count >= RATE_LIMIT) return false;
  row.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!allowIp(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: BeaconBody = {};
  try {
    body = (await req.json()) as BeaconBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name || !isPublicAnalyticsEventName(name)) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  const props: Record<string, unknown> = {
    ...(body.properties && typeof body.properties === "object" ? body.properties : {}),
    ipHint: ip === "unknown" ? undefined : ip.slice(0, 45),
  };

  await prisma.analyticsEvent.create({
    data: {
      userId,
      role,
      name: name.slice(0, 80),
      path: body.path?.slice(0, 300) ?? null,
      properties: props as Prisma.InputJsonValue,
      clientTs: body.clientTs ? new Date(body.clientTs) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
