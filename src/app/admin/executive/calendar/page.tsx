import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { officeFromEmail } from "@/lib/executive/seat-map";
import { ExecutiveCalendar } from "@/components/executive/executive-calendar";

export default async function AdminExecutiveCalendarPage() {
  const session = await getServerSession(authOptions);
  if (!officeFromEmail(session?.user?.email)) redirect("/admin");
  return <ExecutiveCalendar />;
}
