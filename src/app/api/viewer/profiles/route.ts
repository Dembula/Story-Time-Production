import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestViewerSubscription, getViewerProfileLimit } from "@/lib/viewer-access";
import { getDateFromBirthParts, getViewerProfileAge } from "@/lib/viewer-profiles";

function getViewerProfileDelegate() {
  if ("viewerProfile" in prisma && prisma.viewerProfile) return prisma.viewerProfile;
  return null;
}

function toProfileResponse(profile: {
  id: string;
  name: string;
  age: number;
  dateOfBirth?: Date | null;
  updatedAt: Date;
}) {
  return {
    id: profile.id,
    name: profile.name,
    age: getViewerProfileAge(profile) ?? profile.age,
    dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
    updatedAt: profile.updatedAt,
  };
}

async function getMasterProfileId(userId: string, delegate: NonNullable<ReturnType<typeof getViewerProfileDelegate>>) {
  const master = await delegate.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return master?.id ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const delegate = getViewerProfileDelegate();
  if (!delegate) {
    return NextResponse.json(
      { error: "Profiles are not available. Run: npx prisma generate" },
      { status: 503 }
    );
  }

  try {
    const profiles = await delegate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, age: true, dateOfBirth: true, updatedAt: true },
    });
    return NextResponse.json({ profiles: profiles.map(toProfileResponse) });
  } catch (e) {
    console.error("GET /api/viewer/profiles", e);
    const message = e instanceof Error ? e.message : "Failed to load profiles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const delegate = getViewerProfileDelegate();
  if (!delegate) {
    return NextResponse.json(
      { error: "Profiles are not available. Run: npx prisma generate" },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
  } | null;
  const name = body?.name?.trim();
  const birthYear = typeof body?.birthYear === "number" ? Math.floor(body.birthYear) : null;
  const birthMonth = typeof body?.birthMonth === "number" ? Math.floor(body.birthMonth) : null;
  const birthDay = typeof body?.birthDay === "number" ? Math.floor(body.birthDay) : null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!birthYear || !birthMonth || !birthDay) {
    return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
  }

  const dateOfBirth = getDateFromBirthParts(birthYear, birthMonth, birthDay);
  if (
    Number.isNaN(dateOfBirth.getTime()) ||
    dateOfBirth.getUTCFullYear() !== birthYear ||
    dateOfBirth.getUTCMonth() !== birthMonth - 1 ||
    dateOfBirth.getUTCDate() !== birthDay
  ) {
    return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
  }

  const age = getViewerProfileAge({ dateOfBirth });
  if (age == null || age < 0 || age > 120) return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });

  try {
    const subscription = await getLatestViewerSubscription(session.user.id);
    if (!subscription) {
      return NextResponse.json({ error: "Choose a viewer package before creating profiles" }, { status: 400 });
    }

    const maxProfiles = getViewerProfileLimit(subscription);
    const count = await delegate.count({ where: { userId: session.user.id } });
    if (count >= maxProfiles) {
      return NextResponse.json(
        {
          error:
            maxProfiles === 1
              ? "This viewer account supports a single profile only"
              : `This package supports up to ${maxProfiles} profiles`,
        },
        { status: 400 }
      );
    }

    const profile = await delegate.create({
      data: { userId: session.user.id, name, age, dateOfBirth },
      select: { id: true, name: true, age: true, dateOfBirth: true, updatedAt: true },
    });
    return NextResponse.json({ profile: toProfileResponse(profile) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/viewer/profiles", e);
    const message = e instanceof Error ? e.message : "Failed to create profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const delegate = getViewerProfileDelegate();
  if (!delegate) {
    return NextResponse.json(
      { error: "Profiles are not available. Run: npx prisma generate" },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    name?: string;
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    isChild?: boolean;
  } | null;

  const profileId = body?.id?.trim();
  if (!profileId) return NextResponse.json({ error: "Profile id is required" }, { status: 400 });

  const profile = await delegate.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { id: true, name: true, dateOfBirth: true, age: true, updatedAt: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const updates: { name?: string; dateOfBirth?: Date; age?: number } = {};
  if (typeof body?.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = trimmed;
  }

  if (typeof body?.birthYear === "number" && typeof body?.birthMonth === "number" && typeof body?.birthDay === "number") {
    const birthYear = Math.floor(body.birthYear);
    const birthMonth = Math.floor(body.birthMonth);
    const birthDay = Math.floor(body.birthDay);
    const dob = getDateFromBirthParts(birthYear, birthMonth, birthDay);
    if (
      Number.isNaN(dob.getTime()) ||
      dob.getUTCFullYear() !== birthYear ||
      dob.getUTCMonth() !== birthMonth - 1 ||
      dob.getUTCDate() !== birthDay
    ) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
    }
    const derivedAge = getViewerProfileAge({ dateOfBirth: dob });
    if (derivedAge == null || derivedAge < 0 || derivedAge > 120) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
    }
    updates.dateOfBirth = dob;
    updates.age = derivedAge;
  } else if (typeof body?.isChild === "boolean") {
    // Quick toggle for under-18 censorship: we anchor to a safe representative DOB.
    const now = new Date();
    const year = body.isChild ? now.getUTCFullYear() - 10 : now.getUTCFullYear() - 21;
    const dob = getDateFromBirthParts(year, 1, 1);
    updates.dateOfBirth = dob;
    updates.age = getViewerProfileAge({ dateOfBirth: dob }) ?? (body.isChild ? 10 : 21);
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
  }

  const updated = await delegate.update({
    where: { id: profile.id },
    data: updates,
    select: { id: true, name: true, age: true, dateOfBirth: true, updatedAt: true },
  });
  return NextResponse.json({ profile: toProfileResponse(updated) });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const delegate = getViewerProfileDelegate();
  if (!delegate) {
    return NextResponse.json(
      { error: "Profiles are not available. Run: npx prisma generate" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Profile id is required" }, { status: 400 });

  const profile = await delegate.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const masterId = await getMasterProfileId(session.user.id, delegate);
  if (masterId === id) {
    return NextResponse.json({ error: "Master profile cannot be deleted" }, { status: 400 });
  }

  await delegate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

