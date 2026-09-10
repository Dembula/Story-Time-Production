import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExecutiveActor } from "@/lib/executive/seats";
import { writeExecutiveAudit } from "@/lib/executive/audit";
import { decryptExecutiveMessage, encryptExecutiveMessage } from "@/lib/executive/comms-crypto";
import { EXECUTIVE_SEAT_EMAILS, type ExecutiveOffice } from "@/lib/executive/seat-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canAccessSensitivity(office: ExecutiveOffice, sensitivity: string): boolean {
  if (sensitivity === "FINANCIAL") return office === "CFO" || office === "CEO";
  if (sensitivity === "TECHNICAL") return office === "CIO" || office === "CEO" || office === "COO";
  if (sensitivity === "PERSONAL") return office === "CEO";
  return true;
}

export async function GET(req: NextRequest) {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const threadId = new URL(req.url).searchParams.get("threadId");

  try {
    if (threadId) {
      const membership = await prisma.executiveThreadMember.findUnique({
        where: { threadId_userId: { threadId, userId: actor.userId } },
      });
      const thread = await prisma.executiveThread.findUnique({ where: { id: threadId } });
      if (!thread || (!membership && thread.kind !== "ANNOUNCEMENT")) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      if (!canAccessSensitivity(actor.office, thread.sensitivity)) {
        return NextResponse.json({ error: "Insufficient clearance for this thread." }, { status: 403 });
      }

      const messages = await prisma.executiveMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { sender: { select: { id: true, name: true, email: true } } },
      });

      await prisma.executiveThreadMember.updateMany({
        where: { threadId, userId: actor.userId },
        data: { lastReadAt: new Date() },
      });

      await writeExecutiveAudit({
        userId: actor.userId,
        email: actor.email,
        office: actor.office,
        action: "READ_THREAD",
        entityType: "ExecutiveThread",
        entityId: threadId,
      });

      return NextResponse.json({
        thread,
        messages: messages.map((m) => ({
          id: m.id,
          body: decryptExecutiveMessage(m.ciphertext, m.iv),
          priority: m.priority,
          pinned: m.pinned,
          meta: m.meta,
          createdAt: m.createdAt.toISOString(),
          sender: m.sender,
        })),
      });
    }

    const threads = await prisma.executiveThread.findMany({
      where: {
        OR: [
          { members: { some: { userId: actor.userId } } },
          { kind: "ANNOUNCEMENT" },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        _count: { select: { messages: true } },
        members: { select: { userId: true, office: true } },
      },
    });

    const visible = threads.filter((t) => canAccessSensitivity(actor.office, t.sensitivity));

    return NextResponse.json({
      threads: visible.map((t) => ({
        id: t.id,
        subject: t.subject,
        kind: t.kind,
        sensitivity: t.sensitivity,
        department: t.department,
        updatedAt: t.updatedAt.toISOString(),
        messageCount: t._count.messages,
        memberCount: t.members.length,
      })),
    });
  } catch (e) {
    console.error("GET /api/executive/comms", e);
    return NextResponse.json({ threads: [], error: "Comms unavailable until migration is applied." });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = (await req.json().catch(() => null)) as {
    action?: "create_thread" | "send_message";
    subject?: string;
    kind?: string;
    sensitivity?: string;
    body?: string;
    threadId?: string;
    priority?: string;
    memberEmails?: string[];
  } | null;

  if (body?.action === "create_thread") {
    const subject = body.subject?.trim() || "Executive discussion";
    const sensitivity = body.sensitivity || "STANDARD";
    if (!canAccessSensitivity(actor.office, sensitivity)) {
      return NextResponse.json({ error: "Cannot create this sensitivity class." }, { status: 403 });
    }
    if (body.kind === "ANNOUNCEMENT" && actor.office !== "CEO") {
      return NextResponse.json({ error: "Only CEO can post company announcements." }, { status: 403 });
    }

    try {
      const memberEmails = new Set<string>([actor.email]);
      for (const email of body.memberEmails ?? []) {
        const normalized = email.trim().toLowerCase();
        if (EXECUTIVE_SEAT_EMAILS[normalized]) memberEmails.add(normalized);
      }

      const users = await prisma.user.findMany({
        where: { email: { in: [...memberEmails] } },
        select: { id: true, email: true },
      });

      const thread = await prisma.executiveThread.create({
        data: {
          subject,
          kind: body.kind || "GROUP",
          sensitivity,
          members: {
            create: users.map((u) => ({
              userId: u.id,
              office: u.email ? EXECUTIVE_SEAT_EMAILS[u.email.toLowerCase()] ?? null : null,
            })),
          },
        },
      });

      await writeExecutiveAudit({
        userId: actor.userId,
        email: actor.email,
        office: actor.office,
        action: "CREATE_THREAD",
        entityType: "ExecutiveThread",
        entityId: thread.id,
      });

      return NextResponse.json({ thread: { id: thread.id } }, { status: 201 });
    } catch (e) {
      console.error("create_thread", e);
      return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
    }
  }

  if (body?.action === "send_message") {
    const threadId = body.threadId?.trim();
    const text = body.body?.trim();
    if (!threadId || !text) {
      return NextResponse.json({ error: "threadId and body required" }, { status: 400 });
    }

    try {
      const thread = await prisma.executiveThread.findUnique({ where: { id: threadId } });
      if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      if (!canAccessSensitivity(actor.office, thread.sensitivity)) {
        return NextResponse.json({ error: "Insufficient clearance." }, { status: 403 });
      }

      const membership = await prisma.executiveThreadMember.findUnique({
        where: { threadId_userId: { threadId, userId: actor.userId } },
      });
      if (!membership && thread.kind !== "ANNOUNCEMENT") {
        await prisma.executiveThreadMember.create({
          data: { threadId, userId: actor.userId, office: actor.office },
        });
      }

      const encrypted = encryptExecutiveMessage(text);
      const message = await prisma.executiveMessage.create({
        data: {
          threadId,
          senderId: actor.userId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          priority: body.priority || "NORMAL",
        },
      });
      await prisma.executiveThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });

      await writeExecutiveAudit({
        userId: actor.userId,
        email: actor.email,
        office: actor.office,
        action: "SEND_MESSAGE",
        entityType: "ExecutiveMessage",
        entityId: message.id,
        meta: { sensitivity: thread.sensitivity },
      });

      return NextResponse.json({ message: { id: message.id } }, { status: 201 });
    } catch (e) {
      console.error("send_message", e);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
