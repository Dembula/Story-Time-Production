import { redirect } from "next/navigation";

/** Merged into Finance hub. */
export default function AdminRevenueRedirectPage() {
  redirect("/admin/financial?tab=overview");
}
