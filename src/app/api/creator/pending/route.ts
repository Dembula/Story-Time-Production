import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CREATOR_TYPES = ["content", "music", "equipment", "location", "crew", "casting", "catering"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    email,
    type,
    bio,
    socialLinks,
    education,
    goals,
    previousWork,
    isAfda,
  } = body as {
    email?: string;
    type?: string;
    bio?: string;
    socialLinks?: string;
    education?: string;
    goals?: string;
    previousWork?: string;
    isAfda?: boolean;
  };
  const normalizedEmail = email?.trim()?.toLowerCase();
  if (!normalizedEmail || !type || !CREATOR_TYPES.includes(type as (typeof CREATOR_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid email or type" }, { status: 400 });
  }
  const profile = {
    bio: bio?.trim() || null,
    socialLinks: socialLinks?.trim() || null,
    education: education?.trim() || null,
    goals: goals?.trim() || null,
    previousWork: previousWork?.trim() || null,
    isAfdaStudent: Boolean(isAfda),
  };
  await prisma.pendingCreatorSignup.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, type, ...profile },
    update: { type, ...profile },
  });
  return NextResponse.json({ ok: true });
}
