import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";

const COOKIE_NAME = "st_viewer_profile";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const profileId = cookieStore.get(COOKIE_NAME)?.value;
  if (!profileId) return NextResponse.json({ profile: null });

  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { id: true, name: true, age: true, dateOfBirth: true },
  });

  return NextResponse.json({
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          age: getViewerProfileAge(profile) ?? profile.age,
          dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
        }
      : null,
  });
}

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
