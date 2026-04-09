import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminReviewHubClient } from "./admin-review-hub-client";

export default async function AdminReviewHubPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    redirect("/auth/signin");
  }
  return <AdminReviewHubClient />;
}
