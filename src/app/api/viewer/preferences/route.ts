import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let prefs = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });
  if (!prefs) {
    prefs = await prisma.userPreference.create({
      data: { userId: session.user.id },
    });
  }
  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { theme, accentColor, notifyEmail, playbackQuality } = body;

  const data: Record<string, unknown> = {};
  if (theme !== undefined) data.theme = theme;
  if (accentColor !== undefined) data.accentColor = accentColor;
  if (typeof notifyEmail === "boolean") data.notifyEmail = notifyEmail;
  if (playbackQuality !== undefined) data.playbackQuality = playbackQuality;

  const prefs = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });
  return NextResponse.json(prefs);
}
