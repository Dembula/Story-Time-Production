import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packFestivalImageUrl, packFestivalVideoUrl } from "@/lib/festival/media-urls";

type Ctx = { params: Promise<{ submissionId: string }> };

async function loadOwnedSubmission(submissionId: string, userId: string, isAdmin: boolean) {
  return prisma.festivalSubmission.findFirst({
    where: isAdmin ? { id: submissionId } : { id: submissionId, creatorUserId: userId },
    include: {
      festival: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          headerImageUrl: true,
          acceptingSubmissions: true,
        },
      },
      category: { select: { id: true, name: true, regularFeeZar: true } },
    },
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  if (!userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { submissionId } = await ctx.params;
  const submission = await loadOwnedSubmission(submissionId, userId, role === "ADMIN");
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stillUrls = Array.isArray(submission.stillUrls)
    ? submission.stillUrls
        .filter((u): u is string => typeof u === "string")
        .map((u) => packFestivalImageUrl(u) ?? u)
    : [];

  return NextResponse.json({
    submission: {
      ...submission,
      screenerUrl: packFestivalVideoUrl(submission.screenerUrl) ?? submission.screenerUrl,
      trailerUrl: packFestivalVideoUrl(submission.trailerUrl) ?? submission.trailerUrl,
      stillUrls,
      festival: submission.festival
        ? {
            ...submission.festival,
            headerImageUrl:
              packFestivalImageUrl(submission.festival.headerImageUrl) ??
              submission.festival.headerImageUrl,
          }
        : submission.festival,
    },
    editable: submission.paymentStatus === "AWAITING_PAYMENT",
  });
}

/** Update an unpaid submission before checkout completes. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  if (!userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { submissionId } = await ctx.params;
  const submission = await loadOwnedSubmission(submissionId, userId, role === "ADMIN");
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (submission.paymentStatus !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      { error: "Only unpaid submissions can be edited. Contact the festival after payment." },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : submission.title;
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const contact = body.contact && typeof body.contact === "object" ? body.contact : null;
  const contactEmail =
    contact && typeof (contact as { email?: unknown }).email === "string"
      ? String((contact as { email: string }).email).trim()
      : "";
  const contactPhone =
    contact && typeof (contact as { phone?: unknown }).phone === "string"
      ? String((contact as { phone: string }).phone).trim()
      : "";
  if (contact) {
    if (!contactEmail || !contactEmail.includes("@")) {
      return NextResponse.json({ error: "Contact email is required." }, { status: 400 });
    }
    if (!contactPhone) {
      return NextResponse.json({ error: "Contact phone is required." }, { status: 400 });
    }
  }

  const rawScreener =
    typeof body.screenerUrl === "string" ? body.screenerUrl.trim() : submission.screenerUrl || "";
  if (!rawScreener) {
    return NextResponse.json({ error: "Screener upload or URL is required." }, { status: 400 });
  }

  const stillUrls = Array.isArray(body.stillUrls)
    ? body.stillUrls
        .filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u: string) => packFestivalImageUrl(u.trim()) ?? u.trim())
    : Array.isArray(submission.stillUrls)
      ? submission.stillUrls.filter((u): u is string => typeof u === "string")
      : [];

  const rawTrailer =
    typeof body.trailerUrl === "string"
      ? body.trailerUrl.trim()
      : submission.trailerUrl?.trim() || "";

  const categoryId =
    typeof body.categoryId === "string" && body.categoryId
      ? body.categoryId
      : submission.categoryId;

  if (categoryId !== submission.categoryId) {
    const category = await prisma.festivalCategory.findFirst({
      where: { id: categoryId, festivalId: submission.festivalId },
    });
    if (!category) {
      return NextResponse.json({ error: "Invalid category for this festival." }, { status: 400 });
    }
  }

  const updated = await prisma.festivalSubmission.update({
    where: { id: submission.id },
    data: {
      title,
      categoryId,
      logline:
        typeof body.logline === "string" ? body.logline.trim() || null : submission.logline,
      synopsis:
        typeof body.synopsis === "string" ? body.synopsis.trim() || null : submission.synopsis,
      formPayload:
        body.formPayload ??
        (body.contact || body.credits || body.specifications
          ? {
              contact: body.contact ?? null,
              credits: body.credits ?? null,
              specifications: body.specifications ?? null,
            }
          : undefined),
      screenerUrl: packFestivalVideoUrl(rawScreener) ?? rawScreener,
      trailerUrl: rawTrailer ? packFestivalVideoUrl(rawTrailer) ?? rawTrailer : null,
      stillUrls,
      universeOptIn:
        typeof body.universeOptIn === "boolean" ? body.universeOptIn : submission.universeOptIn,
    },
    include: {
      festival: { select: { id: true, name: true, status: true } },
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ submission: updated });
}
