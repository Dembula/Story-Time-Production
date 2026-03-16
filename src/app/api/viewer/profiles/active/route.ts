import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "st_viewer_profile";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { profileId?: string } | null;
  const profileId = body?.profileId?.trim();
  if (!profileId) return NextResponse.json({ error: "profileId is required" }, { status: 400 });

  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId: session.user.id },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, profileId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res;
}
