import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CommandCenterClient } from "./command-center-client";

export default async function CommandCenterPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) redirect("/auth/signin");

  return <CommandCenterClient />;
}
