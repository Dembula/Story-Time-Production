import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

const CREATOR_TYPES = ["content", "music", "equipment", "location", "crew", "casting", "catering"] as const;
const ROLE_MAP: Record<string, string> = {
  music: "MUSIC_CREATOR",
  equipment: "EQUIPMENT_COMPANY",
  location: "LOCATION_OWNER",
  content: "CONTENT_CREATOR",
  crew: "CREW_TEAM",
  casting: "CASTING_AGENCY",
  catering: "CATERING_COMPANY",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      type,
      name,
      bio,
      socialLinks,
      education,
      goals,
      previousWork,
      isAfda,
    } = body as {
      email?: string;
      password?: string;
      type?: string;
      name?: string;
      bio?: string;
      socialLinks?: string;
      education?: string;
      goals?: string;
      previousWork?: string;
      isAfda?: boolean;
    };

    const normalizedEmail = email?.trim()?.toLowerCase();
    if (!normalizedEmail || !password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Email and password (min 6 characters) are required" },
        { status: 400 }
      );
    }
    if (!type || !CREATOR_TYPES.includes(type as (typeof CREATOR_TYPES)[number])) {
      return NextResponse.json(
        { error: "Valid creator type is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hash(password, 10);
    const role = ROLE_MAP[type] ?? "CONTENT_CREATOR";

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        role,
        passwordHash,
        bio: bio?.trim() || null,
        socialLinks: socialLinks?.trim() || null,
        education: education?.trim() || null,
        goals: goals?.trim() || null,
        previousWork: previousWork?.trim() || null,
        isAfdaStudent: Boolean(isAfda),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Creator register error:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
