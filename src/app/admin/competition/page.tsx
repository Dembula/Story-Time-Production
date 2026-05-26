import { requireAdminSession } from "@/lib/admin-auth";
import { AdminCompetitionClient } from "./admin-competition-client";

export default async function AdminCompetitionPage() {
  await requireAdminSession();
  return <AdminCompetitionClient />;
}
