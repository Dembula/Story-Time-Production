import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNavSections } from "@/lib/admin-nav";
import { filterAdminNavSections, parseAdminRights } from "@/lib/admin-permissions";
import { AdminLayoutShell } from "./admin-layout-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let navSections = adminNavSections;

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "ADMIN" && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, adminRights: true },
    });
    navSections = filterAdminNavSections(adminNavSections, parseAdminRights(user?.adminRights), user?.email);
  }

  return <AdminLayoutShell navSections={navSections}>{children}</AdminLayoutShell>;
}
