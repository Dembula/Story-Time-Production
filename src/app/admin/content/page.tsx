import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminContentClient } from "./admin-content-client";

export default async function AdminContentPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    redirect("/auth/signin");
  }

  return <AdminContentClient />;
}
