import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const methods = await prisma.viewerPaymentMethod.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(methods);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, lastFour, isDefault } = body as { label: string; lastFour: string; isDefault?: boolean };
  if (!label || !lastFour || lastFour.length !== 4) {
    return NextResponse.json({ error: "label and lastFour (4 digits) required" }, { status: 400 });
  }

  const count = await prisma.viewerPaymentMethod.count({ where: { userId: session.user.id } });
  const setDefault = isDefault === true || count === 0;

  if (setDefault) {
    await prisma.viewerPaymentMethod.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const method = await prisma.viewerPaymentMethod.create({
    data: {
      userId: session.user.id,
      label: label.trim(),
      lastFour: String(lastFour).slice(-4),
      isDefault: setDefault,
    },
  });
  return NextResponse.json(method, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, isDefault } = body as { id: string; isDefault: boolean };
  if (!id || !isDefault) return NextResponse.json({ error: "id and isDefault required" }, { status: 400 });

  const method = await prisma.viewerPaymentMethod.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!method) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.viewerPaymentMethod.updateMany({
    where: { userId: session.user.id },
    data: { isDefault: false },
  });
  const updated = await prisma.viewerPaymentMethod.update({
    where: { id },
    data: { isDefault: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const method = await prisma.viewerPaymentMethod.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!method) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.viewerPaymentMethod.delete({ where: { id } });
  if (method.isDefault) {
    const next = await prisma.viewerPaymentMethod.findFirst({ where: { userId: session.user.id } });
    if (next) await prisma.viewerPaymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return NextResponse.json({ success: true });
}
