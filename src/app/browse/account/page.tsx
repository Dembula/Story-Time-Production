import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountClient } from "./account-client";
import { prisma } from "@/lib/prisma";

export default async function BrowseAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");
  const params = searchParams ? await searchParams : {};

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          payments: { orderBy: { createdAt: "desc" }, take: 5 },
          paymentMethod: { select: { label: true, lastFour: true } },
        },
      },
      viewerPaymentMethods: {
        where: { reusable: true },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: { label: true, lastFour: true },
      },
    },
  });

  const raw = user?.viewerSubscriptions?.[0] ?? null;
  const savedCard = raw?.paymentMethod ?? user?.viewerPaymentMethods?.[0] ?? null;
  const activePpvTitles =
    raw?.viewerModel === "PPV" && user
      ? await prisma.viewerContentAccess.count({
          where: {
            userId: user.id,
            status: "COMPLETED",
            expiresAt: { gt: new Date() },
          },
        })
      : 0;
  const subscription = raw
    ? {
        id: raw.id,
        viewerModel: raw.viewerModel,
        plan: raw.plan,
        status: raw.status,
        trialEndsAt: raw.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: raw.currentPeriodEnd?.toISOString() ?? null,
        deviceCount: raw.deviceCount,
        profileLimit: raw.profileLimit,
        billingEmail: raw.billingEmail,
        paymentMethodLabel: savedCard?.label ?? null,
        cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
        lastPaymentStatus: raw.lastPaymentStatus,
        lastPaymentError: raw.lastPaymentError,
        activePpvTitles,
        payments: raw.payments.map((p) => ({
          amount: p.amount,
          status: p.status,
          paidAt: p.paidAt?.toISOString() ?? null,
        })),
      }
    : null;

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold text-white mb-2">My subscription</h1>
        <p className="text-slate-400 mb-8">Manage your plan, devices, and billing</p>
        <AccountClient subscription={subscription} planUpdated={params.updated === "1"} />
      </div>
    </div>
  );
}
