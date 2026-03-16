import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminRequestsClient } from "./admin-requests-client";

export default async function AdminRequestsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    redirect("/auth/signin");
  }

  return <AdminRequestsClient />;
}
