import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const deck = await prisma.pitchDeck.findUnique({
    where: { projectId },
    include: { slides: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ deck: deck ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        template?: string;
        title?: string | null;
        slides?: { title?: string | null; body?: string | null; mediaUrl?: string | null }[];
      }
    | null;

  const existing = await prisma.pitchDeck.findUnique({
    where: { projectId },
    include: { slides: true },
  });

  if (existing) {
    return NextResponse.json({ error: "Pitch deck already exists" }, { status: 400 });
  }

  const template = body?.template ?? "SHORT_FILM";
  const defaultSlides = [
    { title: "Title", body: "", sortOrder: 0 },
    { title: "Logline", body: "", sortOrder: 1 },
    { title: "Story", body: "", sortOrder: 2 },
    { title: "Team", body: "", sortOrder: 3 },
    { title: "Budget & Timeline", body: "", sortOrder: 4 },
    { title: "Ask", body: "", sortOrder: 5 },
  ];

  const deck = await prisma.pitchDeck.create({
    data: {
      projectId,
      template,
      title: body?.title ?? null,
      createdById: userId,
      slides: {
        create: (body?.slides?.length ? body.slides : defaultSlides).map((s, i) => ({
          sortOrder: i,
          title: s.title ?? null,
          body: s.body ?? null,
          mediaUrl: "mediaUrl" in s ? (s as { mediaUrl?: string | null }).mediaUrl ?? null : null,
        })),
      },
    },
    include: { slides: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ deck }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string | null;
        slides?: { id?: string; sortOrder?: number; title?: string | null; body?: string | null; mediaUrl?: string | null }[];
      }
    | null;

  const deck = await prisma.pitchDeck.findUnique({
    where: { projectId },
    include: { slides: true },
  });

  if (!deck) {
    return NextResponse.json({ error: "Pitch deck not found" }, { status: 404 });
  }

  if (body?.title !== undefined) {
    await prisma.pitchDeck.update({
      where: { id: deck.id },
      data: { title: body.title },
    });
  }

  if (body?.slides?.length) {
    for (const s of body.slides) {
      if (s.id) {
        await prisma.pitchDeckSlide.update({
          where: { id: s.id },
          data: {
            ...(s.sortOrder !== undefined ? { sortOrder: s.sortOrder } : {}),
            ...(s.title !== undefined ? { title: s.title } : {}),
            ...(s.body !== undefined ? { body: s.body } : {}),
            ...(s.mediaUrl !== undefined ? { mediaUrl: s.mediaUrl } : {}),
          },
        });
      } else {
        await prisma.pitchDeckSlide.create({
          data: {
            deckId: deck.id,
            sortOrder: s.sortOrder ?? deck.slides.length,
            title: s.title ?? null,
            body: s.body ?? null,
            mediaUrl: s.mediaUrl ?? null,
          },
        });
      }
    }
  }

  const updated = await prisma.pitchDeck.findUnique({
    where: { id: deck.id },
    include: { slides: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ deck: updated });
}
