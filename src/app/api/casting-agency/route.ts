import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;
  const agency = await prisma.castingAgency.findUnique({
    where: { userId: userId! },
    include: { talent: { orderBy: { sortOrder: "asc" } }, _count: { select: { inquiries: true } } },
  });
  return NextResponse.json(agency);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const role = (session.user as { role?: string })?.role;
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (existing) return NextResponse.json({ error: "Profile already exists" }, { status: 400 });
  const body = await req.json();
  const agency = await prisma.castingAgency.create({
    data: {
      userId: userId!,
      agencyName: body.agencyName ?? "My Agency",
      tagline: body.tagline ?? null,
      description: body.description ?? null,
      location: body.location ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      website: body.website ?? null,
      contactEmail: body.contactEmail ?? null,
      logoUrl: body.logoUrl ?? null,
    },
    include: { talent: true },
  });
  return NextResponse.json(agency);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (!agency) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.castingAgency.update({
    where: { id: agency.id },
    data: {
      agencyName: body.agencyName ?? agency.agencyName,
      tagline: body.tagline !== undefined ? body.tagline : agency.tagline,
      description: body.description !== undefined ? body.description : agency.description,
      location: body.location !== undefined ? body.location : agency.location,
      city: body.city !== undefined ? body.city : agency.city,
      country: body.country !== undefined ? body.country : agency.country,
      website: body.website !== undefined ? body.website : agency.website,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : agency.contactEmail,
      logoUrl: body.logoUrl !== undefined ? body.logoUrl : agency.logoUrl,
    },
    include: { talent: true },
  });
  return NextResponse.json(updated);
}
