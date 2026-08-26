import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getClientIpFromRequest,
  getDeviceTypeForRequest,
  getPlatformHeaderFromRequest,
  getUserAgentFromRequest,
} from "@/lib/request-client-meta";

/** Records IP + device for signed-in users (debounced on the client). Used by admin analytics. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? "SUBSCRIBER";
  const ip = getClientIpFromRequest(req);
  const userAgent = getUserAgentFromRequest(req);
  const deviceType = getDeviceTypeForRequest(req);
  const platform = getPlatformHeaderFromRequest(req);
  // Native apps may also POST platform/device in JSON (ignored for auth; used for UA fallback).
  const body = (await req.json().catch(() => null)) as {
    platform?: string;
    device?: string;
    eventType?: string;
  } | null;
  const eventType =
    body?.eventType === "SIGN_IN" || body?.eventType === "REGISTER"
      ? body.eventType
      : "ACCESS_TELEMETRY";
  const ua =
    userAgent ||
    (typeof body?.device === "string" && body.device.trim()
      ? `StoryTimeNative/${body.device.trim()}`
      : null);

  await prisma.activityLog.create({
    data: {
      userId,
      userEmail: session.user?.email ?? undefined,
      userName: session.user?.name ?? undefined,
      role,
      eventType,
      ipAddress: ip ?? undefined,
      userAgent: ua ?? undefined,
      deviceType,
    },
  });

  return NextResponse.json({
    ok: true,
    deviceType,
    platform: platform ?? body?.platform ?? null,
  });
}
