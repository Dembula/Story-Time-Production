import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminCreatorsClient } from "./admin-creators-client";

export default async function AdminCreatorsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") redirect("/auth/signin");

  return <AdminCreatorsClient />;
}
