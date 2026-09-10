import { redirect } from "next/navigation";
import { executiveHomePath, officeFromEmail } from "@/lib/executive/seat-map";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Legacy portal — bounce into the admin-nested suite. */
export default async function LegacyExecutiveLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const office = officeFromEmail(session?.user?.email);
  redirect(office ? executiveHomePath(office) : "/admin");
  return children;
}
