import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNavSections } from "@/lib/admin-nav";
import { filterAdminNavSections } from "@/lib/admin-permissions";
import {
  executiveHomePath,
  officeFromEmail,
  type ExecutiveOffice,
} from "@/lib/executive/seat-map";
import { AdminLayoutShell } from "./admin-layout-shell";
import type { DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";

function withExecutiveNav(
  sections: DashboardNavSection[],
  office: ExecutiveOffice | null,
): DashboardNavSection[] {
  if (!office) {
    return sections.filter((section) => section.title !== "Executive suite");
  }

  return sections.map((section) => {
    if (section.title !== "Executive suite") return section;
    return {
      ...section,
      items: section.items.map((item) =>
        item.href === "/admin/executive"
          ? { ...item, href: executiveHomePath(office), label: `${office} dashboard` }
          : item,
      ),
    };
  });
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let navSections = adminNavSections;

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const email = session?.user?.email ?? null;
  const office = officeFromEmail(email);

  if (role === "ADMIN" && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, adminRights: true },
    });
    navSections = filterAdminNavSections(adminNavSections, user?.adminRights ?? null, user?.email);
  } else if (office) {
    // Seat without full admin rights: show executive suite + public site only.
    navSections = adminNavSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.href.startsWith("/admin/executive") ||
            item.href === "/admin/executive" ||
            item.href === "/browse",
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  navSections = withExecutiveNav(navSections, office);

  return (
    <AdminLayoutShell navSections={navSections} office={office}>
      {children}
    </AdminLayoutShell>
  );
}
