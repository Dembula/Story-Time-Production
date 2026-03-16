import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const syncRequestId = req.nextUrl.searchParams.get("syncRequestId");

  if (syncRequestId) {
    const messages = await prisma.message.findMany({
      where: { syncRequestId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(messages);
  }

  const messages = await prisma.message.findMany({
    where: {
      syncRequestId: { not: null },
      OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
      syncRequest: { select: { id: true, status: true, track: { select: { title: true } }, projectName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body, receiverId, syncRequestId } = await req.json();

  if (!body || !receiverId) return NextResponse.json({ error: "body and receiverId required" }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      body,
      senderId: session.user.id,
      receiverId,
      syncRequestId: syncRequestId || null,
    },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(message);
}
