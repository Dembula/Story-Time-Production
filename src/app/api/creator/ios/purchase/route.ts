import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  processCreatorApplePurchase,
  type CreatorApplePurchaseBody,
} from "@/lib/payments/apple-iap/activate-creator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = (session.user as { id?: string }).id;
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
      : await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, email: true },
        });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreatorApplePurchaseBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const result = await processCreatorApplePurchase({
      userId: user.id,
      email: user.email,
      body,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : "Creator Apple purchase failed";
    console.error("POST /api/creator/ios/purchase", message);
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
