import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upsertUserPreferences } from "@/lib/user-settings-persistence";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const prefs = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: {},
    });
    return NextResponse.json(prefs);
  } catch (error) {
    console.error("GET /api/viewer/preferences", error);
    return NextResponse.json(
      {
        error:
          "Preferences storage is unavailable. Run database migrations: npx prisma migrate deploy",
      },
      { status: 503 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { theme, accentColor, notifyEmail, playbackQuality } = body;
  const notify =
    notifyEmail === undefined
      ? undefined
      : notifyEmail === true || notifyEmail === "true" || notifyEmail === 1 || notifyEmail === "1";

  try {
    const prefs = await upsertUserPreferences(session.user.id, {
      theme: typeof theme === "string" ? theme : undefined,
      accentColor: typeof accentColor === "string" ? accentColor : undefined,
      notifyEmail: notify,
      playbackQuality: typeof playbackQuality === "string" ? playbackQuality : undefined,
    });
    return NextResponse.json(prefs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save preferences." },
      { status: 400 },
    );
  }
}
