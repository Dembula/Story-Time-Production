import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMonthlyUpdateEmail } from "@/lib/sendgrid";

export async function POST() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [users, latestContent] = await Promise.all([
      db.user.findMany({
        where: { email: { not: null } },
        select: { email: true },
      }),
      db.content.findMany({
        where: { published: true },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          title: true,
          type: true,
          creator: {
            select: { name: true, role: true },
          },
        },
      }),
    ]);

    const emails = [
      ...new Set(users.map((u) => u.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e))),
    ];
    const latestReleases = latestContent.map((item) => ({
      title: item.title,
      type: item.type,
      creatorName: item.creator?.name || "Story Time Creator",
    }));

    const creatorHighlightsMap = new Map<string, { name: string; role?: string | null }>();
    for (const item of latestContent) {
      const name = item.creator?.name?.trim();
      if (!name) continue;
      if (!creatorHighlightsMap.has(name)) {
        creatorHighlightsMap.set(name, { name, role: item.creator?.role });
      }
      if (creatorHighlightsMap.size >= 4) break;
    }
    const creatorHighlights = Array.from(creatorHighlightsMap.values());

    const bodyParts = [
      latestReleases.length
        ? `This month we dropped ${latestReleases.length} new title${latestReleases.length === 1 ? "" : "s"}.`
        : "We are building the next wave of Story Time releases.",
      creatorHighlights.length
        ? `Featured creators: ${creatorHighlights.map((c) => c.name).join(", ")}.`
        : "",
    ].filter(Boolean);

    await sendMonthlyUpdateEmail(emails, {
      subject: "Story Time Monthly Update",
      preview: "New releases, creator highlights, and platform improvements.",
      body: bodyParts.join(" "),
      latestReleases,
      creatorHighlights,
    });

    return NextResponse.json({ ok: true, sent: emails.length });
  } catch (error) {
    console.error("Admin monthly update send failed:", error);
    return NextResponse.json({ error: "Failed to send monthly update." }, { status: 500 });
  }
}
