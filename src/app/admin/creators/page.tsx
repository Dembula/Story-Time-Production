import { requireAdminSession } from "@/lib/admin-auth";
import { AdminCreatorsClient } from "./admin-creators-client";

export default async function AdminCreatorsPage() {
  await requireAdminSession();
  return <AdminCreatorsClient />;
}
