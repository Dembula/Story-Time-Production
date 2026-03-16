import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const note = await prisma.scriptReviewNote.findFirst({
    where: { userId, projectId: null },
  });

  return NextResponse.json({ notes: note ?? { body: "" } });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        notesBody?: string;
      }
    | null;

  if (!body?.notesBody && body?.notesBody !== "") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const record = await prisma.scriptReviewNote.upsert({
    where: {
      userId_projectId: {
        userId,
        projectId: null,
      },
    },
    create: {
      userId,
      projectId: null,
      body: body.notesBody ?? "",
    },
    update: {
      body: body.notesBody ?? "",
    },
  });

  return NextResponse.json({ notes: record });
}

