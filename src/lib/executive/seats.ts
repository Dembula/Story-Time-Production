import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EXECUTIVE_SEAT_EMAILS,
  executiveHomePath,
  normalizeExecutiveEmail,
  officeFromEmail,
  type ExecutiveOffice,
} from "@/lib/executive/seat-map";

export type ExecutiveActor = {
  userId: string;
  email: string;
  office: ExecutiveOffice;
  name: string | null;
  isAdmin: boolean;
  homePath: string;
};

/** Resolve seat from static map first (source of truth for routing), sync DB row when possible. */
export async function resolveExecutiveOfficeForEmail(
  email: string | null | undefined,
): Promise<ExecutiveOffice | null> {
  const fromMap = officeFromEmail(email);
  if (fromMap) return fromMap;

  const normalized = normalizeExecutiveEmail(email);
  if (!normalized) return null;

  try {
    const seat = await prisma.executiveSeat.findFirst({
      where: { email: normalized, active: true },
      select: { office: true },
    });
    if (seat && ["CEO", "COO", "CMO", "CFO", "CIO"].includes(seat.office)) {
      return seat.office as ExecutiveOffice;
    }
  } catch {
    // Table may not exist yet during migrate
  }
  return null;
}

export async function ensureExecutiveSeatLinked(userId: string, email: string, office: ExecutiveOffice) {
  const normalized = normalizeExecutiveEmail(email);
  if (!normalized) return;
  try {
    await prisma.executiveSeat.upsert({
      where: { email: normalized },
      create: { email: normalized, office, userId, active: true },
      update: { office, userId, active: true },
    });
  } catch {
    // ignore if migration not applied
  }
}

export async function requireExecutiveActor(): Promise<
  ExecutiveActor | { error: string; status: number }
> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = normalizeExecutiveEmail(session?.user?.email);
  if (!userId || !email) {
    return { error: "Unauthorized", status: 401 };
  }

  const office = await resolveExecutiveOfficeForEmail(email);
  if (!office) {
    return { error: "No executive seat for this account.", status: 403 };
  }

  const role = (session?.user as { role?: string } | undefined)?.role;
  void ensureExecutiveSeatLinked(userId, email, office);

  return {
    userId,
    email,
    office,
    name: session?.user?.name ?? null,
    isAdmin: role === "ADMIN",
    homePath: executiveHomePath(office),
  };
}

export async function requireExecutiveOffice(
  expected: ExecutiveOffice,
): Promise<ExecutiveActor | { error: string; status: number }> {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return actor;
  if (actor.office !== expected) {
    return { error: "You cannot access another executive office.", status: 403 };
  }
  return actor;
}

export function listSeedSeatEmails(): Array<{ email: string; office: ExecutiveOffice }> {
  return Object.entries(EXECUTIVE_SEAT_EMAILS).map(([email, office]) => ({ email, office }));
}
