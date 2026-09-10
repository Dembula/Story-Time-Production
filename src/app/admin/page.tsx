import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { executiveHomePath, officeFromEmail } from "@/lib/executive/seat-map";
import { AdminOverviewClient } from "./admin-overview-client";

export default async function AdminPage() {
  const session = await requireAdminSession();
  const office = officeFromEmail(session.user?.email);
  if (office) {
    redirect(executiveHomePath(office));
  }
  return <AdminOverviewClient />;
}
