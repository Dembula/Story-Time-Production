import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import { normalizeAvatarImageUrl } from "@/lib/avatar-image-url";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      bio: true,
      socialLinks: true,
      education: true,
      goals: true,
      previousWork: true,
      isAfdaStudent: true,
      headline: true,
      location: true,
      website: true,
      professionalName: true,
      bannerImageUrl: true,
      primaryRole: true,
      skills: true,
      expertiseAreas: true,
      yearsExperience: true,
      availabilityStatus: true,
      reputationScore: true,
      networkProfilePublic: true,
      creatorAccountStructure: true,
      creatorTeamSeatCap: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const phoneRow = await prisma
    .$queryRawUnsafe<{ phoneNumber: string | null }[]>(`SELECT "phoneNumber" FROM "User" WHERE "id" = $1`, session.user.id)
    .catch(() => []);

  return NextResponse.json({
    ...user,
    phoneNumber: phoneRow[0]?.phoneNumber ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phoneNumber, currentPassword, newPassword, bio, socialLinks, education, goals, previousWork, headline, location, website, isAfdaStudent, image } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (image !== undefined) {
    try {
      data.image = normalizeAvatarImageUrl(typeof image === "string" ? image : "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid image URL";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
  if (bio !== undefined) data.bio = bio;
  if (socialLinks !== undefined) data.socialLinks = typeof socialLinks === "string" ? socialLinks : JSON.stringify(socialLinks);
  if (education !== undefined) data.education = education;
  if (goals !== undefined) data.goals = goals;
  if (previousWork !== undefined) data.previousWork = previousWork;
  if (typeof isAfdaStudent === "boolean") data.isAfdaStudent = isAfdaStudent;

  if (email !== undefined) {
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalized) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const existing = await prisma.user.findFirst({
      where: { email: normalized, id: { not: session.user.id } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    data.email = normalized;
  }

  if (newPassword !== undefined) {
    const current = typeof currentPassword === "string" ? currentPassword : "";
    const next = typeof newPassword === "string" ? newPassword : "";
    if (next.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    const userAuth = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (userAuth?.passwordHash) {
      const ok = await compare(current, userAuth.passwordHash);
      if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    data.passwordHash = await hash(next, 10);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      bio: true,
      socialLinks: true,
      education: true,
      goals: true,
      previousWork: true,
      isAfdaStudent: true,
    },
  });

  // Update network profile fields via raw SQL (columns may not be in generated client yet)
  if (headline !== undefined || location !== undefined || website !== undefined || phoneNumber !== undefined) {
    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (headline !== undefined) {
      updates.push(`"headline" = $${i++}`);
      values.push(headline);
    }
    if (location !== undefined) {
      updates.push(`"location" = $${i++}`);
      values.push(location);
    }
    if (website !== undefined) {
      updates.push(`"website" = $${i++}`);
      values.push(website);
    }
    if (phoneNumber !== undefined) {
      updates.push(`"phoneNumber" = $${i++}`);
      values.push(typeof phoneNumber === "string" ? phoneNumber.trim() : null);
    }
    if (updates.length) {
      values.push(session.user.id);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET ${updates.join(", ")} WHERE "id" = $${i}`,
        ...values
      );
    }
  }

  const extra = await prisma.$queryRawUnsafe<{ headline: string | null; location: string | null; website: string | null; phoneNumber: string | null }[]>(
    `SELECT "headline", "location", "website", "phoneNumber" FROM "User" WHERE "id" = $1`,
    session.user.id
  ).catch(() => []);
  const profile = extra[0];
  return NextResponse.json({
    ...updated,
    headline: profile?.headline ?? null,
    location: profile?.location ?? null,
    website: profile?.website ?? null,
    phoneNumber: profile?.phoneNumber ?? null,
  });
}
