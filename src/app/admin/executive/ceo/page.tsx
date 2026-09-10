import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executiveHomePath, officeFromEmail } from "@/lib/executive/seat-map";
import { OfficeDashboard } from "@/components/executive/office-dashboard";

export default async function AdminExecutiveCeoPage() {
  const session = await getServerSession(authOptions);
  const office = officeFromEmail(session?.user?.email);
  if (!office) redirect("/admin");
  if (office !== "CEO") redirect(executiveHomePath(office));
  return <OfficeDashboard />;
}
