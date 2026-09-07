import { requireAdminSession } from "@/lib/admin-auth";
import { AdminMarketplaceVendorsClient } from "./admin-marketplace-vendors-client";

export default async function AdminMarketplaceVendorsPage() {
  await requireAdminSession();
  return <AdminMarketplaceVendorsClient />;
}
