import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { cateringCompany: true },
  });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(user.cateringCompany);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    companyName,
    tagline,
    description,
    city,
    country,
    specializations,
    minOrder,
    contactEmail,
    website,
  } = body;

  if (!companyName) return NextResponse.json({ error: "companyName required" }, { status: 400 });

  const company = await prisma.cateringCompany.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      companyName,
      tagline: tagline || null,
      description: description || null,
      city: city || null,
      country: country || null,
      specializations: specializations || null,
      minOrder: minOrder != null ? parseFloat(minOrder) : null,
      contactEmail: contactEmail || null,
      website: website || null,
    },
    update: {
      companyName,
      tagline: tagline || null,
      description: description || null,
      city: city || null,
      country: country || null,
      specializations: specializations || null,
      minOrder: minOrder != null ? parseFloat(minOrder) : null,
      contactEmail: contactEmail || null,
      website: website || null,
    },
  });

  return NextResponse.json(company);
}
