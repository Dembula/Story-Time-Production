import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { verifyProfilePin } from "@/lib/viewer-profile-pin";
import {
  VIEWER_PROFILE_COOKIE,
  VIEWER_PROFILE_COOKIE_MAX_AGE,
  VIEWER_PROFILE_UNLOCK_COOKIE,
  VIEWER_PROFILE_UNLOCK_MAX_AGE,
  viewerProfileCookieOptions,
} from "@/lib/viewer-profile-cookies";

function activeProfilePayload(profile: {
  id: string;
  name: string;
  age: number;
  dateOfBirth: Date | null;
  pinEnabled: boolean;
}) {
  return {
    id: profile.id,
    name: profile.name,
    age: getViewerProfileAge(profile) ?? profile.age,
    dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
    pinEnabled: profile.pinEnabled,
  };
}

function setProfileCookies(res: NextResponse, profileId: string, pinEnabled: boolean) {
  res.cookies.set(VIEWER_PROFILE_COOKIE, profileId, viewerProfileCookieOptions(VIEWER_PROFILE_COOKIE_MAX_AGE));
  if (pinEnabled) {
    res.cookies.set(
      VIEWER_PROFILE_UNLOCK_COOKIE,
      profileId,
      viewerProfileCookieOptions(VIEWER_PROFILE_UNLOCK_MAX_AGE)
    );
  } else {
    res.cookies.delete(VIEWER_PROFILE_UNLOCK_COOKIE);
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const profileId = cookieStore.get(VIEWER_PROFILE_COOKIE)?.value;
  if (!profileId) return NextResponse.json({ profile: null });

  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { id: true, name: true, age: true, dateOfBirth: true, pinEnabled: true },
  });

  return NextResponse.json({
    profile: profile ? activeProfilePayload(profile) : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { profileId?: string; pin?: string } | null;
  const profileId = body?.profileId?.trim();
  if (!profileId) return NextResponse.json({ error: "profileId is required" }, { status: 400 });

  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { id: true, name: true, age: true, dateOfBirth: true, pinEnabled: true, pinHash: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (profile.pinEnabled) {
    const pin = typeof body?.pin === "string" ? body.pin : "";
    if (!pin) {
      return NextResponse.json(
        { error: "PIN is required for this profile", requiresPin: true, profile: activeProfilePayload(profile) },
        { status: 401 }
      );
    }
    const valid = await verifyProfilePin(pin, profile.pinHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect PIN", requiresPin: true }, { status: 403 });
    }
  }

  const res = NextResponse.json({ ok: true, profile: activeProfilePayload(profile) });
  setProfileCookies(res, profileId, profile.pinEnabled);
  return res;
}
