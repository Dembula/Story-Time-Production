/**
 * Integration test: studio company owner invite → invitee accept.
 * Run: npx tsx scripts/test-studio-team-invites.ts
 * Requires DATABASE_URL (loads .env.local when present).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "bcryptjs";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const { PrismaClient } = require("../generated/prisma") as {
  PrismaClient: new () => import("../generated/prisma").PrismaClient;
};

async function main() {
  const prisma = new PrismaClient();
  const runId = Date.now();
  const ownerEmail = `studio-invite-owner-${runId}@storytime-test.local`;
  const memberEmail = `studio-invite-member-${runId}@storytime-test.local`;
  const passwordHash = await hash("test-password-12", 10);

  const cleanup: Array<() => Promise<void>> = [];

  try {
    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Invite Test Owner",
        role: "CONTENT_CREATOR",
        passwordHash,
        creatorAccountStructure: "COMPANY",
        creatorTeamSeatCap: 3,
      },
    });
    cleanup.push(async () => {
      await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    });

    const company = await prisma.studioCompany.create({
      data: {
        ownerUserId: owner.id,
        displayName: "Test Studio Co",
        seatCap: 3,
      },
    });
    cleanup.push(async () => {
      await prisma.studioCompany.delete({ where: { id: company.id } }).catch(() => {});
    });

    const ownerProfile = await prisma.creatorStudioProfile.create({
      data: {
        userId: owner.id,
        companyId: company.id,
        displayName: "Invite Test Owner",
        kind: "COMPANY",
        teamRole: "Admin",
      },
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: { activeCreatorStudioProfileId: ownerProfile.id },
    });

    const token = `testtoken${runId}${"a".repeat(32)}`.slice(0, 48);
    const invite = await prisma.creatorStudioTeamInvite.create({
      data: {
        companyId: company.id,
        invitedByUserId: owner.id,
        emailNorm: memberEmail,
        status: "PENDING",
        suiteAccess: ["pipeline_pre"],
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    cleanup.push(async () => {
      await prisma.creatorStudioTeamInvite.delete({ where: { id: invite.id } }).catch(() => {});
    });

    const member = await prisma.user.create({
      data: {
        email: memberEmail,
        name: "Invite Test Member",
        role: "CONTENT_CREATOR",
        passwordHash,
        creatorAccountStructure: "INDIVIDUAL",
      },
    });
    cleanup.push(async () => {
      await prisma.user.delete({ where: { id: member.id } }).catch(() => {});
    });

    const { acceptStudioTeamInviteForUser } = await import(
      "../src/lib/creator-studio-team-invite-accept"
    );

    const decline = await acceptStudioTeamInviteForUser({
      userId: member.id,
      email: memberEmail,
      displayName: member.name,
      token,
      action: "decline",
    });
    assertResult(decline.ok && decline.status === "DECLINED", "decline");

    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "PENDING" },
    });

    const wrongEmail = await acceptStudioTeamInviteForUser({
      userId: member.id,
      email: "wrong@storytime-test.local",
      displayName: member.name,
      token,
      action: "accept",
    });
    assertResult(
      !wrongEmail.ok && "status" in wrongEmail && wrongEmail.status === 403,
      "wrong email blocked",
    );

    const accepted = await acceptStudioTeamInviteForUser({
      userId: member.id,
      email: memberEmail,
      displayName: member.name,
      token,
      action: "accept",
    });
    assertResult(accepted.ok && accepted.status === "ACCEPTED", "accept");

    const profile = await prisma.creatorStudioProfile.findFirst({
      where: { userId: member.id, companyId: company.id },
    });
    if (!profile) throw new Error("Member profile not created after accept");
    cleanup.push(async () => {
      await prisma.creatorStudioProfile.delete({ where: { id: profile.id } }).catch(() => {});
    });

    const updatedInvite = await prisma.creatorStudioTeamInvite.findUnique({
      where: { id: invite.id },
    });
    if (updatedInvite?.status !== "ACCEPTED") {
      throw new Error(`Expected invite ACCEPTED, got ${updatedInvite?.status}`);
    }

    const { ensureOwnedStudioCompanyForUser } = await import("../src/lib/creator-studio-company");
    await prisma.studioCompany.delete({ where: { id: company.id } });
    await prisma.creatorStudioProfile.update({
      where: { id: ownerProfile.id },
      data: { companyId: null, kind: "INDIVIDUAL" },
    });
    await ensureOwnedStudioCompanyForUser(owner.id);
    const repaired = await prisma.studioCompany.findFirst({ where: { ownerUserId: owner.id } });
    if (!repaired) throw new Error("ensureOwnedStudioCompanyForUser did not recreate company");

    console.log(
      JSON.stringify(
        {
          ok: true,
          tests: ["decline", "wrong-email", "accept", "company-repair"],
          ownerEmail,
          memberEmail,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const fn of cleanup.reverse()) {
      await fn();
    }
    await prisma.$disconnect();
  }
}

function assertResult(cond: boolean, label: string) {
  if (!cond) throw new Error(`Assertion failed: ${label}`);
}

main().catch((err) => {
  console.error("Studio team invite integration test failed:", err);
  process.exit(1);
});
