import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBreakdown, upsertBreakdown } from "@/lib/breakdownStore";

interface Params {
  params: { projectId: string };
}

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const record = await getBreakdown(params.projectId);
  return NextResponse.json(record);
}

// Bulk upsert simple breakdown items; each array element may have optional id for update
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        characters?: { id?: string; name: string; description?: string | null; importance?: string | null }[];
        props?: { id?: string; name: string; description?: string | null; special?: boolean }[];
        locations?: { id?: string; name: string; description?: string | null }[];
        wardrobe?: { id?: string; description: string; character?: string | null }[];
        extras?: { id?: string; description: string; quantity?: number }[];
        vehicles?: { id?: string; description: string; stuntRelated?: boolean }[];
        stunts?: { id?: string; description: string; safetyNotes?: string | null }[];
        sfx?: { id?: string; description: string; practical?: boolean }[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const record = await upsertBreakdown(params.projectId, body as any);
  return NextResponse.json(record);
}

