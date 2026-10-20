import { redirect } from "next/navigation";

export default function AdminFestivalRemittancesRedirectPage() {
  redirect("/admin/financial?tab=festivals");
}
