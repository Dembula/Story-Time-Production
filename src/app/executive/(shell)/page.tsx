import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { executiveHomePath, officeFromEmail } from "@/lib/executive/seat-map";

export default async function ExecutiveIndexPage() {
  const session = await getServerSession(authOptions);
  const office = officeFromEmail(session?.user?.email);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!office) {
    redirect(role === "ADMIN" ? "/admin" : "/profiles");
  }

  redirect(executiveHomePath(office));
}
