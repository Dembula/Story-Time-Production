import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { prisma } from "@/lib/prisma";

import {

  notifyCateringBookingCreated,

  notifyCateringBookingStatus,

} from "@/lib/marketplace-notifications";

import { buildMarketplaceBookingNote } from "@/lib/marketplace-booking-context";

import { parseCateringCompanyProfile } from "@/lib/company-marketplace-profiles";

import {

  enrichCateringBookingForClient,

  resolveCateringQuotedAmountForApproval,

} from "@/lib/catering-booking-enrich";



const cateringCompanySelect = {

  companyName: true,

  tagline: true,

  userId: true,

  minOrder: true,

  description: true,

  logoUrl: true,

} as const;



export async function GET() {

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });



  const user = await prisma.user.findUnique({ where: { email: session.user.email } });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });



  const role = (session.user as { role?: string }).role;

  if (role === "CONTENT_CREATOR") {

    const bookings = await prisma.cateringBooking.findMany({

      where: { creatorId: user.id },

      include: { cateringCompany: { select: cateringCompanySelect } },

      orderBy: { createdAt: "desc" },

    });

    return NextResponse.json(bookings.map(enrichCateringBookingForClient));

  }

  if (role === "CATERING_COMPANY") {

    const company = await prisma.cateringCompany.findUnique({ where: { userId: user.id } });

    if (!company) return NextResponse.json([]);

    const bookings = await prisma.cateringBooking.findMany({

      where: { cateringCompanyId: company.id },

      include: {

        creator: { select: { id: true, name: true, email: true } },

        _count: { select: { messages: true } },

      },

      orderBy: { createdAt: "desc" },

    });

    return NextResponse.json(bookings);

  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });

}



export async function POST(req: Request) {

  const session = await getServerSession(authOptions);

  const role = (session?.user as { role?: string })?.role;

  if (role !== "CONTENT_CREATOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });



  const body = await req.json();

  const { cateringCompanyId, eventDate, headCount, note, projectId, projectTitle } = body as {

    cateringCompanyId?: string;

    eventDate?: string;

    headCount?: number;

    note?: string;

    projectId?: string;

    projectTitle?: string;

  };

  if (!cateringCompanyId) return NextResponse.json({ error: "cateringCompanyId required" }, { status: 400 });



  const user = await prisma.user.findUnique({ where: { email: session?.user?.email ?? undefined } });

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });



  const company = await prisma.cateringCompany.findUnique({

    where: { id: cateringCompanyId },

    select: { id: true, companyName: true, userId: true, description: true, minOrder: true },

  });

  if (!company) return NextResponse.json({ error: "Catering company not found" }, { status: 404 });



  if (headCount != null) {

    const profile = parseCateringCompanyProfile(company);

    const minHeads = profile.meta?.minHeadCount;

    const maxHeads = profile.meta?.maxHeadCount;

    if (minHeads != null && headCount < minHeads) {

      return NextResponse.json(

        { error: `Minimum head count for this caterer is ${minHeads}` },

        { status: 400 },

      );

    }

    if (maxHeads != null && headCount > maxHeads) {

      return NextResponse.json(

        { error: `Maximum head count for this caterer is ${maxHeads}` },

        { status: 400 },

      );

    }

  }



  const bookingNote = buildMarketplaceBookingNote(note || null, {

    projectId: projectId ?? null,

    projectTitle: projectTitle ?? null,

  });



  const booking = await prisma.cateringBooking.create({

    data: {

      cateringCompanyId,

      creatorId: user.id,

      eventDate: eventDate || null,

      headCount: headCount ?? null,

      note: bookingNote,

      status: "PENDING",

    },

    include: { cateringCompany: { select: cateringCompanySelect } },

  });



  try {

    await notifyCateringBookingCreated({

      companyUserId: company.userId,

      creatorName: user.name,

      companyName: company.companyName,

      bookingId: booking.id,

    });

  } catch {

    /* non-blocking */

  }



  return NextResponse.json(enrichCateringBookingForClient(booking));

}



export async function PATCH(req: Request) {

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });



  const role = (session.user as { role?: string }).role;

  if (role !== "CATERING_COMPANY" && role !== "ADMIN") {

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  }



  const user = await prisma.user.findUnique({ where: { email: session.user.email } });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });



  const company = await prisma.cateringCompany.findUnique({ where: { userId: user.id } });

  if (!company) return NextResponse.json({ error: "Catering company not found" }, { status: 404 });



  const body = await req.json();

  const { id, status, quotedAmount } = body as {

    id?: string;

    status?: string;

    quotedAmount?: number | null;

  };

  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });



  const existing = await prisma.cateringBooking.findFirst({

    where: { id, cateringCompanyId: company.id },

    include: { cateringCompany: { select: { companyName: true } } },

  });

  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });



  let resolvedQuote: number | null | undefined;

  if (status === "APPROVED") {

    resolvedQuote = await resolveCateringQuotedAmountForApproval(id, quotedAmount);

    if (!resolvedQuote || resolvedQuote <= 0) {

      return NextResponse.json(

        {

          error:

            "Set a quoted amount on your profile (per-head rate or min order) or pass quotedAmount when approving.",

        },

        { status: 400 },

      );

    }

  }



  const updated = await prisma.cateringBooking.update({

    where: { id },

    data: {

      status,

      ...(status === "APPROVED" && resolvedQuote != null ? { quotedAmount: resolvedQuote } : {}),

    },

    include: {

      creator: { select: { id: true, name: true, email: true } },

      cateringCompany: { select: cateringCompanySelect },

      _count: { select: { messages: true } },

    },

  });



  if (status !== existing.status) {

    try {

      await notifyCateringBookingStatus({

        creatorUserId: existing.creatorId,

        companyName: existing.cateringCompany.companyName,

        status,

        bookingId: id,

      });

    } catch {

      /* non-blocking */

    }

  }



  return NextResponse.json(updated);

}

