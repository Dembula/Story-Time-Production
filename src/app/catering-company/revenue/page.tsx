import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CateringRevenueClient } from "./catering-revenue-client";

export default async function CateringRevenuePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/catering-company/revenue"));
  if ((session.user as { role?: string }).role !== "CATERING_COMPANY") redirect("/catering-company/dashboard");

  return <CateringRevenueClient />;
}
