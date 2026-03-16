import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PackageClient } from "./package-client";

export default async function OnboardingPackagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const sub = user?.viewerSubscriptions?.[0];
  const hasActive = sub && (sub.status === "TRIAL_ACTIVE" || sub.status === "ACTIVE");
  if (hasActive) redirect("/profiles");

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Choose your plan</h1>
        <p className="text-slate-400 text-center mb-10">Start with a 3-day free trial or pay now</p>
        <PackageClient />
      </div>
    </div>
  );
}
