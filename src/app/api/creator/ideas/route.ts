import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(_req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const ideas = await prisma.projectIdea.findMany({
    where: { userId: access.userId!, projectId: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        logline?: string;
        notes?: string;
        genres?: string;
      }
    | null;

  if (!body?.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const idea = await prisma.projectIdea.create({
    data: {
      userId: access.userId!,
      projectId: null,
      title: body.title,
      logline: body.logline ?? null,
      notes: body.notes ?? null,
      genres: body.genres ?? null,
      convertedToProject: false,
    },
  });

  return NextResponse.json({ idea }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        title?: string;
        logline?: string | null;
        notes?: string | null;
        genres?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const data: {
    title?: string;
    logline?: string | null;
    notes?: string | null;
    genres?: string | null;
  } = {};

  if (body.title !== undefined) data.title = body.title;
  if (body.logline !== undefined) data.logline = body.logline;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.genres !== undefined) data.genres = body.genres;

  const updated = await prisma.projectIdea.updateMany({
    where: { id: body.id, userId: access.userId!, projectId: null },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const idea = await prisma.projectIdea.findUnique({ where: { id: body.id } });

  return NextResponse.json({ idea });
}


