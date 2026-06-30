import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function issueTalentPortalToken(talentId: string, expiresInDays = 30) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);
  await prisma.castingTalentPortalToken.deleteMany({ where: { talentId } });
  const row = await prisma.castingTalentPortalToken.create({
    data: { talentId, token, expiresAt },
  });
  return row;
}

export async function resolveTalentPortalToken(token: string) {
  const row = await prisma.castingTalentPortalToken.findUnique({
    where: { token },
    include: {
      talent: {
        include: {
          castingAgency: { select: { agencyName: true } },
          availabilityBlocks: { orderBy: { startDate: "asc" }, take: 12 },
          projectContracts: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { project: { select: { title: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
          },
          castingInvitations: {
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { project: { select: { title: true } }, role: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!row || row.expiresAt < new Date()) return null;
  return row;
}

export function talentPortalUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/talent/portal/${token}`;
}
