import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CompanyAccountClient } from "./company-account-client";

export default async function EquipmentCompanyAccountPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "EQUIPMENT_COMPANY" && role !== "ADMIN")) {
    redirect(signInUrlForDestination("/equipment-company/account"));
  }

  return (
    <CompanyAccountClient
      backHref="/equipment-company/dashboard"
      title="Account"
      subtitle="Your company account details. Manage your listings from My Listings."
    />
  );
}
