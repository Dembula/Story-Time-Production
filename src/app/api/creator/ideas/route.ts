import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createIdeaForUser,
  listIdeasForUser,
  updateIdeaForUser,
} from "@/lib/ideaStore";

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

  const ideas = await listIdeasForUser(access.userId!, null);

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

  const idea = await createIdeaForUser({
    userId: access.userId!,
    projectId: null,
    title: body.title,
    logline: body.logline ?? null,
    notes: body.notes ?? null,
    genres: body.genres ?? null,
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

  const updated = await updateIdeaForUser({
    userId: access.userId!,
    id: body.id,
    projectId: null,
    title: body.title,
    logline: body.logline,
    notes: body.notes,
    genres: body.genres,
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ idea: updated });
}

