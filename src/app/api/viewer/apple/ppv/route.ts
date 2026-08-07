import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  activateAppleViewerPpv,
  type AppleActivateBody,
} from "@/lib/payments/apple-iap/activate-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user =
      (session.user.id
        ? await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, email: true },
          })
        : null) ??
      (session.user.email
        ? await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, email: true },
          })
        : null);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as AppleActivateBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const result = await activateAppleViewerPpv({
      userId: user.id,
      email: user.email,
      body: { ...body, kind: "ppv" },
    });

    return NextResponse.json({
      ok: true,
      contentId: result.contentId,
      alreadyOwned: true,
      alreadyApplied: result.alreadyApplied,
    });
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : "Apple PPV activate failed";
    console.error("POST /api/viewer/apple/ppv", message);
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
