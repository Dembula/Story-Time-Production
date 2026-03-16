import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getConnectionStatus,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
} from "@/lib/network-db";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId: targetId } = await params;
  const status = await getConnectionStatus(session.user.id, targetId);
  return NextResponse.json({ status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId: targetId } = await params;
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message : undefined;
  await sendConnectionRequest(session.user.id, targetId, message);
  return NextResponse.json({ status: "PENDING_SENT" });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId: _targetId } = await params;
  const body = await req.json();
  const { action, requestId } = body as { action?: string; requestId?: string };
  if (!requestId || (action !== "accept" && action !== "decline")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (action === "accept") {
    await acceptConnectionRequest(requestId, session.user.id);
    return NextResponse.json({ status: "ACCEPTED" });
  }
  await declineConnectionRequest(requestId, session.user.id);
  return NextResponse.json({ status: "DECLINED" });
}
