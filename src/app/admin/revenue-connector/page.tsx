import { requireAdminSession } from "@/lib/admin-auth";
import { RevenueConnectorClient } from "./revenue-connector-client";

export default async function AdminRevenueConnectorPage() {
  await requireAdminSession();
  return <RevenueConnectorClient />;
}
