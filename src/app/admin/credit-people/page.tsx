import { requireAdminSession } from "@/lib/admin-auth";
import { AdminCreditPeopleClient } from "./admin-credit-people-client";

export default async function AdminCreditPeoplePage() {
  await requireAdminSession();
  return <AdminCreditPeopleClient />;
}
