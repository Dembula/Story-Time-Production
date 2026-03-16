import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminActivityClient } from "./admin-activity-client";

export default async function AdminActivityPage() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session || role !== "ADMIN") redirect("/auth/signin");
  } catch {
    redirect("/auth/signin");
  }

  return <AdminActivityClient />;
}
