import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDeletableCatalogueStatus } from "@/lib/catalogue-upload/types";

type RouteCtx = { params: Promise<{ contentId: string }> };

/**
 * DELETE /api/creator/content/[contentId]
 * Remove a mistaken catalogue upload owned by the signed-in creator.
 * Blocked for APPROVED (live) titles — unpublish / ask admin instead.
 */
export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contentId } = await ctx.params;
  const id = contentId?.trim();
  if (!id) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  const creatorId = session!.user!.id as string;
  const existing = await prisma.content.findFirst({
    where: role === "ADMIN" ? { id } : { id, creatorId },
    select: { id: true, title: true, reviewStatus: true, creatorId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isDeletableCatalogueStatus(existing.reviewStatus)) {
    return NextResponse.json(
      {
        error:
          existing.reviewStatus === "APPROVED"
            ? "Approved catalogue titles cannot be deleted from My catalogue. Ask an admin to unpublish first if you need it removed."
            : `This title cannot be deleted while status is ${existing.reviewStatus}.`,
      },
      { status: 409 },
    );
  }

  await prisma.content.delete({ where: { id: existing.id } });

  return NextResponse.json({
    ok: true,
    deletedId: existing.id,
    title: existing.title,
  });
}
