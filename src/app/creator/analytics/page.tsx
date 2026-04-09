import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreatorAnalyticsClient } from "./creator-analytics-client";

export default async function CreatorAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) redirect("/auth/signin");

  return <CreatorAnalyticsClient />;
}
