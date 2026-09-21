import { requireAdminSession } from "@/lib/admin-auth";
import { AdminVaTicketsClient } from "./admin-va-tickets-client";

export default async function AdminVaTicketsPage() {
  await requireAdminSession();
  return <AdminVaTicketsClient />;
}
