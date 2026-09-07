import { redirect } from "next/navigation";

/** Merged into Finance hub sheets. */
export default function AdminPaymentsRedirectPage() {
  redirect("/admin/financial?tab=sheets");
}
