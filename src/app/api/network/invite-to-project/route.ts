import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assertCanInviteToProject,
  inviteRegisteredUserToProject,
} from "@/lib/project-collaborator-invites";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    inviteeUserId?: string;
    role?: string;
    department?: string | null;
  } | null;

  const projectId = body?.projectId?.trim();
  const inviteeUserId = body?.inviteeUserId?.trim();
  if (!projectId || !inviteeUserId) {
    return NextResponse.json({ error: "projectId and inviteeUserId are required" }, { status: 400 });
  }

  const gate = await assertCanInviteToProject(projectId, userId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const result = await inviteRegisteredUserToProject({
    projectId,
    projectTitle: gate.project.title,
    inviteeUserId,
    invitedByUserId: userId,
    inviterName: session.user?.name,
    role: body?.role,
    department: body?.department,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.alreadyActive) {
    return NextResponse.json({ error: "That creator is already on this project." }, { status: 409 });
  }
  if (result.alreadyPending) {
    return NextResponse.json(
      { error: "That creator already has a pending invite on this project." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, memberId: result.memberId });
}
