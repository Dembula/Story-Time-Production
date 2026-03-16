import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptConnectionRequest, declineConnectionRequest } from "@/lib/network-db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { requestId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "accept" ? "accept" : body.action === "decline" ? "decline" : null;
  if (!action) return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  if (action === "accept") {
    await acceptConnectionRequest(requestId, session.user.id);
    return NextResponse.json({ status: "ACCEPTED" });
  }
  await declineConnectionRequest(requestId, session.user.id);
  return NextResponse.json({ status: "DECLINED" });
}
