import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  activateAppleViewerPpv,
  activateAppleViewerSubscription,
  type AppleActivateBody,
} from "@/lib/payments/apple-iap/activate-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveViewerUser(session: {
  user?: { id?: string | null; email?: string | null; role?: string } | null;
}) {
  if (!session?.user) return null;
  if (session.user.id) {
    const byId = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true },
    });
    if (byId) return byId;
  }
  if (session.user.email) {
    return prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true },
    });
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await resolveViewerUser(session);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as AppleActivateBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    if (body.kind === "ppv" || body.contentId) {
      const result = await activateAppleViewerPpv({
        userId: user.id,
        email: user.email,
        body,
      });
      return NextResponse.json({
        ok: true,
        contentId: result.contentId,
        alreadyOwned: true,
        alreadyApplied: result.alreadyApplied,
      });
    }

    const result = await activateAppleViewerSubscription({
      userId: user.id,
      email: user.email,
      body,
    });

    return NextResponse.json({
      ok: true,
      plan: result.plan,
      status: result.status,
      alreadyApplied: result.alreadyApplied,
      currentPeriodEnd: result.currentPeriodEnd,
    });
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : "Apple activate failed";
    console.error("POST /api/viewer/apple/activate", message);
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
