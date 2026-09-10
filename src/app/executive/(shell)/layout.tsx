import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { executiveHomePath, officeFromEmail } from "@/lib/executive/seat-map";
import { ExecutiveShell } from "@/components/executive/executive-shell";

export default async function ExecutiveShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "";
  const office = officeFromEmail(email);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "ADMIN";

  if (!office) {
    redirect(isAdmin ? "/admin" : "/profiles");
  }

  return (
    <ExecutiveShell
      office={office}
      email={email}
      name={session?.user?.name ?? null}
      isAdmin={isAdmin}
      homePath={executiveHomePath(office)}
    >
      {children}
    </ExecutiveShell>
  );
}
