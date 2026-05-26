import { requireAdminSession } from "@/lib/admin-auth";
import { AdminUsersClient } from "./admin-users-client";

export default async function AdminUsersPage() {
  await requireAdminSession();
  return <AdminUsersClient />;
}
