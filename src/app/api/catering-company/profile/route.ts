import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta } from "@/lib/marketplace-profile-meta";
import type { CateringMarketMeta } from "@/lib/company-marketplace-profiles";
import { parseCateringCompanyProfile } from "@/lib/company-marketplace-profiles";
import { validateStorageUrlField, validateStorageUrlList } from "@/lib/storage-origin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { cateringCompany: true },
  });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!user.cateringCompany) return NextResponse.json(null);

  const parsed = parseCateringCompanyProfile(user.cateringCompany);
  return NextResponse.json({
    ...user.cateringCompany,
    profile: parsed,
    plainDescription: parsed.plainDescription,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    logoUrl,
    profile: profileInput,
  } = body;

  if (!companyName) return NextResponse.json({ error: "companyName required" }, { status: 400 });

  const logoErr = validateStorageUrlField(logoUrl, "logoUrl");
  if (logoErr) return NextResponse.json({ error: logoErr }, { status: 400 });

  const gallery = profileInput?.galleryUrls;
  if (Array.isArray(gallery) && gallery.length > 0) {
    const galleryErr = validateStorageUrlList(gallery.join("\n"), "galleryUrls");
    if (galleryErr) return NextResponse.json({ error: galleryErr }, { status: 400 });
  }

  const meta: CateringMarketMeta = {
    galleryUrls: Array.isArray(profileInput?.galleryUrls) ? profileInput.galleryUrls : [],
    menuHighlights: Array.isArray(profileInput?.menuHighlights) ? profileInput.menuHighlights : [],
    serviceTypes: Array.isArray(profileInput?.serviceTypes) ? profileInput.serviceTypes : [],
    pricePerHead: profileInput?.pricePerHead ?? null,
    minHeadCount: profileInput?.minHeadCount ?? null,
    maxHeadCount: profileInput?.maxHeadCount ?? null,
  };

  const company = await prisma.cateringCompany.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      companyName,
      tagline: tagline || null,
      description: embedMeta(description || null, meta),
      city: city || null,
      country: country || null,
      specializations: specializations || null,
      minOrder: minOrder != null ? parseFloat(String(minOrder)) : null,
      contactEmail: contactEmail || null,
      website: website || null,
      logoUrl: logoUrl || null,
    },
    update: {
      companyName,
      tagline: tagline || null,
      description: embedMeta(description || null, meta),
      city: city || null,
      country: country || null,
      specializations: specializations || null,
      minOrder: minOrder != null ? parseFloat(String(minOrder)) : null,
      contactEmail: contactEmail || null,
      website: website || null,
      logoUrl: logoUrl || null,
    },
  });

  const parsed = parseCateringCompanyProfile(company);
  return NextResponse.json({ ...company, profile: parsed, plainDescription: parsed.plainDescription });
}
