import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  if (!userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await prisma.festivalSubmission.findMany({
    where: { creatorUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      festival: { select: { id: true, name: true, status: true, slug: true } },
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ submissions });
}
