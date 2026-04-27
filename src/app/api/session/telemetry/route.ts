import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIpFromRequest, getDeviceTypeForRequest, getUserAgentFromRequest } from "@/lib/request-client-meta";

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

  await prisma.activityLog.create({
    data: {
      userId,
      userEmail: session.user?.email ?? undefined,
      userName: session.user?.name ?? undefined,
      role,
      eventType: "ACCESS_TELEMETRY",
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      deviceType,
    },
  });

  return NextResponse.json({ ok: true });
}
