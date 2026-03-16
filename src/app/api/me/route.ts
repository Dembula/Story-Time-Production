import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Network profile fields (may exist in DB even if not in generated client)
  const extra = await prisma.$queryRawUnsafe<{ headline: string | null; location: string | null; website: string | null }[]>(
    `SELECT "headline", "location", "website" FROM "User" WHERE "id" = $1`,
    session.user.id
  ).catch(() => [{}]);
  const profile = extra[0];
  return NextResponse.json({
    ...user,
    headline: profile?.headline ?? null,
    location: profile?.location ?? null,
    website: profile?.website ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, bio, socialLinks, education, goals, previousWork, headline, location, website } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (bio !== undefined) data.bio = bio;
  if (socialLinks !== undefined) data.socialLinks = typeof socialLinks === "string" ? socialLinks : JSON.stringify(socialLinks);
  if (education !== undefined) data.education = education;
  if (goals !== undefined) data.goals = goals;
  if (previousWork !== undefined) data.previousWork = previousWork;

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
    },
  });

  // Update network profile fields via raw SQL (columns may not be in generated client yet)
  if (headline !== undefined || location !== undefined || website !== undefined) {
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
    if (updates.length) {
      values.push(session.user.id);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET ${updates.join(", ")} WHERE "id" = $${i}`,
        ...values
      );
    }
  }

  const extra = await prisma.$queryRawUnsafe<{ headline: string | null; location: string | null; website: string | null }[]>(
    `SELECT "headline", "location", "website" FROM "User" WHERE "id" = $1`,
    session.user.id
  ).catch(() => [{}]);
  const profile = extra[0];
  return NextResponse.json({
    ...updated,
    headline: profile?.headline ?? null,
    location: profile?.location ?? null,
    website: profile?.website ?? null,
  });
}
