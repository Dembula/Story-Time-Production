import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScriptReviewNotes, upsertScriptReviewNotes } from "@/lib/scriptReviewStore";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await getScriptReviewNotes({ userId, projectId: null });
  return NextResponse.json({ notes: notes ?? { body: "" } });
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

  const record = await upsertScriptReviewNotes({
    userId,
    projectId: null,
    body: body.notesBody ?? "",
  });

  return NextResponse.json({ notes: record });
}

