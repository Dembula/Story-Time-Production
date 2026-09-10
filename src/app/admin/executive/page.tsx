import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executiveHomePath, officeFromEmail } from "@/lib/executive/seat-map";

export default async function AdminExecutiveIndexPage() {
  const session = await getServerSession(authOptions);
  const office = officeFromEmail(session?.user?.email);
  if (office) redirect(executiveHomePath(office));
  redirect("/admin");
}
