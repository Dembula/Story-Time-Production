import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CompanyAccountClient } from "@/app/equipment-company/account/company-account-client";

export default async function LocationOwnerAccountPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "LOCATION_OWNER" && role !== "ADMIN")) {
    redirect(signInUrlForDestination("/location-owner/account"));
  }

  return (
    <CompanyAccountClient
      backHref="/location-owner/dashboard"
      title="Account"
      subtitle="Your account details. Manage your listings from My Listings."
    />
  );
}
