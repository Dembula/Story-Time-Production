import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptProjectCollaboratorInvite } from "@/lib/project-collaborator-invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Accept this invite with a creator account." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    action?: "accept" | "decline";
  };
  const token = body.token?.trim();
  const action = body.action === "decline" ? "decline" : "accept";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const result = await acceptProjectCollaboratorInvite({
    token,
    userId,
    userEmail: session.user?.email,
    action,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    declined: result.declined,
    projectId: result.projectId,
    projectTitle: "projectTitle" in result ? result.projectTitle : undefined,
  });
}
