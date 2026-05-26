import { redirect } from "next/navigation";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Server pages: ensure signed-in platform admin or redirect to admin sign-in. */
export async function requireAdminSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    redirect("/auth/admin");
  }
  return session;
}
