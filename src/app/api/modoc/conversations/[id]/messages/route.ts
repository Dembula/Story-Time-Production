import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** POST: Append a message to a MODOC conversation (e.g. assistant content after stream finishes). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const conversation = await prisma.modocConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  let body: { role: string; content: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { role, content } = body;
  if (!role || typeof content !== "string") {
    return NextResponse.json(
      { error: "Body must include role and content (string)" },
      { status: 400 }
    );
  }
  if (!["user", "assistant", "system"].includes(role)) {
    return NextResponse.json({ error: "role must be user, assistant, or system" }, { status: 400 });
  }

  const message = await prisma.modocMessage.create({
    data: { conversationId, role, content },
  });

  return NextResponse.json({ id: message.id });
}
