import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { officeFromEmail } from "@/lib/executive/seat-map";
import { ExecutiveComms } from "@/components/executive/executive-comms";

export default async function AdminExecutiveCommsPage() {
  const session = await getServerSession(authOptions);
  if (!officeFromEmail(session?.user?.email)) redirect("/admin");
  return <ExecutiveComms />;
}
