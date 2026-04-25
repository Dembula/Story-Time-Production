import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CompanyAdminClient, CompanyAdminHeader } from "./company-admin-client";

export default async function CreatorCompanyAdminPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN")) {
    redirect("/auth/signin");
  }

  if (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR") {
    const owned = await prisma.studioCompany.count({ where: { ownerUserId: userId } });
    if (owned === 0) {
      redirect(role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/command-center");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      <CompanyAdminHeader />
      <CompanyAdminClient />
    </div>
  );
}
