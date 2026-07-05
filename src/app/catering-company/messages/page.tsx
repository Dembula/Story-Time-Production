import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CateringMessagesClient } from "./catering-messages-client";

export default async function CateringMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/catering-company/messages"));
  if ((session.user as { role?: string }).role !== "CATERING_COMPANY") redirect("/catering-company/dashboard");

  return <CateringMessagesClient />;
}
