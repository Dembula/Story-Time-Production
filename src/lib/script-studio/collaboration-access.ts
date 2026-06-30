import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ScriptCollaborationMode = "writer" | "producer" | "read_only";

export type ScriptAccessResult = {
  script: {
    id: string;
    userId: string;
    projectId: string | null;
    title: string;
    type: string;
    content: string;
    studioMeta: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  userId: string;
  isAdmin: boolean;
  canWrite: boolean;
  canComment: boolean;
  collaborationMode: ScriptCollaborationMode;
  memberRole: string | null;
};

const ACTIVE_MEMBER_STATUSES = new Set(["ACTIVE", "ACCEPTED"]);

function displayName(user: {
  professionalName: string | null;
  name: string | null;
  email: string | null;
}): string {
  return user.professionalName?.trim() || user.name?.trim() || user.email?.split("@")[0] || "Creator";
}

export function resolveCollaborationMode(memberRole: string | null, isOwner: boolean): ScriptCollaborationMode {
  if (isOwner) return "writer";
  const role = (memberRole ?? "").toLowerCase();
  if (role.includes("producer") && !role.includes("writer") && !role.includes("collaborator")) {
    return "producer";
  }
  if (role.includes("read") || role.includes("viewer")) return "read_only";
  return "writer";
}

export async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
      isAdmin: false,
    };
  }

  return { error: null as NextResponse | null, userId, isAdmin: role === "ADMIN" };
}

export async function ensureScriptAccess(scriptId: string): Promise<
  | { error: NextResponse; access: null }
  | { error: null; access: ScriptAccessResult }
> {
  const session = await ensureCreatorSession();
  if (session.error) return { error: session.error, access: null };

  const script = await prisma.creatorScript.findUnique({
    where: { id: scriptId },
    include: {
      project: {
        include: {
          members: {
            where: { status: { in: [...ACTIVE_MEMBER_STATUSES] } },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  professionalName: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          pitches: { select: { creatorId: true } },
        },
      },
    },
  });

  if (!script) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), access: null };
  }

  const userId = session.userId!;
  const isAdmin = session.isAdmin;

  if (isAdmin || script.userId === userId) {
    return {
      error: null,
      access: {
        script,
        userId,
        isAdmin,
        canWrite: true,
        canComment: true,
        collaborationMode: "writer",
        memberRole: "Owner",
      },
    };
  }

  if (script.projectId && script.project) {
    const member = script.project.members.find((m) => m.userId === userId);
    const pitchOwner = script.project.pitches.some((p) => p.creatorId === userId);
    if (member || pitchOwner) {
      const mode = resolveCollaborationMode(member?.role ?? null, pitchOwner);
      const canWrite = mode === "writer";
      return {
        error: null,
        access: {
          script,
          userId,
          isAdmin,
          canWrite,
          canComment: mode !== "read_only",
          collaborationMode: mode,
          memberRole: member?.role ?? (pitchOwner ? "Lead Creator" : null),
        },
      };
    }

    const companyPeer = await userSharesProjectCompanyAccess(userId, script.projectId);
    if (companyPeer) {
      return {
        error: null,
        access: {
          script,
          userId,
          isAdmin,
          canWrite: companyPeer.canWrite,
          canComment: true,
          collaborationMode: companyPeer.mode,
          memberRole: companyPeer.teamRole,
        },
      };
    }
  }

  return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), access: null };
}

/** Studio company teammates on the same project (company account collaboration). */
async function userSharesProjectCompanyAccess(
  userId: string,
  projectId: string,
): Promise<{ canWrite: boolean; mode: ScriptCollaborationMode; teamRole: string } | null> {
  const myProfiles = await prisma.creatorStudioProfile.findMany({
    where: { userId, companyId: { not: null } },
    select: { companyId: true, teamRole: true },
  });
  if (myProfiles.length === 0) return null;

  const companyIds = myProfiles.map((p) => p.companyId!).filter(Boolean);
  const companyMates = await prisma.creatorStudioProfile.findMany({
    where: { companyId: { in: companyIds } },
    select: { userId: true },
  });
  const mateIds = new Set(companyMates.map((m) => m.userId));

  const projectMate = await prisma.originalMember.findFirst({
    where: {
      projectId,
      userId: { in: [...mateIds] },
      status: { in: [...ACTIVE_MEMBER_STATUSES] },
    },
  });
  if (!projectMate) return null;

  const myProfile = myProfiles.find((p) => p.companyId);
  const teamRole = myProfile?.teamRole ?? "Company teammate";
  const mode = resolveCollaborationMode(teamRole, false);
  return { canWrite: mode === "writer", mode, teamRole };
}

export async function listProjectCollaborators(projectId: string) {
  const members = await prisma.originalMember.findMany({
    where: { projectId, status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          professionalName: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({
    userId: m.userId,
    role: m.role,
    department: m.department,
    status: m.status,
    displayName: displayName(m.user),
    image: m.user.image,
  }));
}

export { displayName };
