import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createProjectCollaboratorEmailInvite } from "@/lib/project-collaborator-invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN" && role !== "MUSIC_CREATOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: string;
    department?: string | null;
    personalMessage?: string | null;
  };

  const origin =
    req.headers.get("origin") ||
    (req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
      : null);

  const result = await createProjectCollaboratorEmailInvite({
    projectId,
    invitedByUserId: userId,
    inviterName: session.user?.name,
    email: body.email ?? "",
    role: body.role,
    department: body.department,
    personalMessage: body.personalMessage,
    origin,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    invite: result.invite,
    registeredOnPlatform: result.registeredOnPlatform,
    joinUrl: result.joinUrl,
    emailed: result.emailed,
    message: result.message,
  });
}
