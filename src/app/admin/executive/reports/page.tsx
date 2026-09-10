import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { officeFromEmail } from "@/lib/executive/seat-map";
import { ExecutiveReports } from "@/components/executive/executive-reports";

export default async function AdminExecutiveReportsPage() {
  const session = await getServerSession(authOptions);
  if (!officeFromEmail(session?.user?.email)) redirect("/admin");
  return <ExecutiveReports />;
}
