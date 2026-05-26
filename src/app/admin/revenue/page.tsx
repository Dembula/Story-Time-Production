import { requireAdminSession } from "@/lib/admin-auth";
import { AdminRevenueClient } from "./admin-revenue-client";

export default async function AdminRevenuePage() {
  await requireAdminSession();
  return <AdminRevenueClient />;
}
