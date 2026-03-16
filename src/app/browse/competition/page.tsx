import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CompetitionClient } from "./competition-client";

export default async function CompetitionPage() {
  const session = await getServerSession(authOptions);
  const period = await prisma.competitionPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { endDate: "desc" },
    include: { winner: { select: { id: true, name: true } } },
  });

  const creators = await prisma.user.findMany({
    where: { role: "CONTENT_CREATOR", contents: { some: { published: true } } },
    select: { id: true, name: true },
    take: 50,
  });

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <CompetitionClient
          initialPeriod={period ? { id: period.id, name: period.name, endDate: period.endDate.toISOString(), winner: period.winner } : null}
          creators={creators}
          isLoggedIn={!!session?.user}
        />
      </div>
    </div>
  );
}
