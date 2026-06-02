import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type CompanyRole =
  | "EQUIPMENT_COMPANY"
  | "LOCATION_OWNER"
  | "CREW_TEAM"
  | "CATERING_COMPANY"
  | "CASTING_AGENCY"
  | "ADMIN";

export async function requireCompanySession(
  allowed: CompanyRole[],
): Promise<
  { ok: true; userId: string; role: string } | { ok: false; status: number; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };

  const role = (session.user as { role?: string })?.role ?? "";
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (!allowed.includes(role as CompanyRole)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, userId, role };
}
