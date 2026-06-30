import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assignLocationManager,
  listManagedListings,
  listManagersForOwner,
  listOwnerListings,
  removeLocationManager,
  resolveManagerUserIdByEmail,
} from "@/lib/stakeholder-ecosystem/location-manager-service";

async function requireLocationOwner() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "LOCATION_OWNER") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { userId };
}

export async function GET() {
  const access = await requireLocationOwner();
  if (access.error) return access.error;
  const [owned, managed, assignments] = await Promise.all([
    listOwnerListings(access.userId!),
    listManagedListings(access.userId!),
    listManagersForOwner(access.userId!),
  ]);
  return NextResponse.json({ owned, managed, assignments });
}

export async function POST(req: NextRequest) {
  const access = await requireLocationOwner();
  if (access.error) return access.error;
  const body = await req.json().catch(() => ({}));

  if (body.action === "remove" && body.listingId && body.managerUserId) {
    const result = await removeLocationManager({
      ownerUserId: access.userId!,
      listingId: body.listingId,
      managerUserId: body.managerUserId,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!body.listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  let managerUserId = body.managerUserId as string | undefined;
  if (!managerUserId && body.managerEmail) {
    const user = await resolveManagerUserIdByEmail(String(body.managerEmail));
    if (!user) {
      return NextResponse.json({ error: "No Story Time account found for that email" }, { status: 404 });
    }
    managerUserId = user.id;
  }
  if (!managerUserId) {
    return NextResponse.json({ error: "managerUserId or managerEmail required" }, { status: 400 });
  }

  const result = await assignLocationManager({
    ownerUserId: access.userId!,
    listingId: body.listingId,
    managerUserId,
    canApproveBookings: body.canApproveBookings,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ manager: result.manager });
}

export async function DELETE(req: NextRequest) {
  const access = await requireLocationOwner();
  if (access.error) return access.error;
  const listingId = req.nextUrl.searchParams.get("listingId");
  const managerUserId = req.nextUrl.searchParams.get("managerUserId");
  if (!listingId || !managerUserId) {
    return NextResponse.json({ error: "listingId and managerUserId required" }, { status: 400 });
  }
  const result = await removeLocationManager({
    ownerUserId: access.userId!,
    listingId,
    managerUserId,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
