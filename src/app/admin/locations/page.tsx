import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLocationsClient } from "./admin-locations-client";

export default async function AdminLocationsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") redirect("/auth/signin");
  return <AdminLocationsClient />;
}
