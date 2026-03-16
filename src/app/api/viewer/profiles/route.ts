import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getViewerProfileDelegate() {
  if ("viewerProfile" in prisma && prisma.viewerProfile) return prisma.viewerProfile;
  return null;
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
      select: { id: true, name: true, age: true, updatedAt: true },
    });
    return NextResponse.json({ profiles });
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

  const body = (await req.json().catch(() => null)) as { name?: string; age?: number } | null;
  const name = body?.name?.trim();
  const age = typeof body?.age === "number" ? Math.floor(body.age) : 18;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (age < 0 || age > 120) return NextResponse.json({ error: "Invalid age" }, { status: 400 });

  try {
    const count = await delegate.count({ where: { userId: session.user.id } });
    if (count >= 5) return NextResponse.json({ error: "Maximum profiles reached" }, { status: 400 });

    const profile = await delegate.create({
      data: { userId: session.user.id, name, age },
      select: { id: true, name: true, age: true, updatedAt: true },
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (e) {
    console.error("POST /api/viewer/profiles", e);
    const message = e instanceof Error ? e.message : "Failed to create profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

