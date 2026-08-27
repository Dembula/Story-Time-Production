import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  processCreatorApplePurchase,
  type CreatorApplePurchaseBody,
} from "@/lib/payments/apple-iap/activate-creator";
import { getUserRoles } from "@/lib/user-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATOR_APP_ROLES = new Set(["CONTENT_CREATOR", "MUSIC_CREATOR"]);

function sessionHasCreatorRole(session: {
  user?: { id?: string | null; role?: string | null; roles?: string[] | null } | null;
}): boolean {
  const role = session.user?.role ?? null;
  if (role && CREATOR_APP_ROLES.has(role)) return true;
  const roles = session.user?.roles;
  if (Array.isArray(roles) && roles.some((r) => CREATOR_APP_ROLES.has(r))) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } })
      : await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, email: true, role: true },
        });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prefer session role, but also accept multi-role accounts that hold a creator role.
    let allowed = sessionHasCreatorRole(session);
    if (!allowed) {
      const roles = await getUserRoles(user.id, user.role);
      allowed = [...roles].some((r) => CREATOR_APP_ROLES.has(r));
    }
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Forbidden. Sign in with a film or music creator account, then tap Restore Purchases.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as CreatorApplePurchaseBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const result = await processCreatorApplePurchase({
      userId: user.id,
      email: user.email,
      body,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : "Creator Apple purchase failed";
    console.error("POST /api/creator/ios/purchase", message);
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
