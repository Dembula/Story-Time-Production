import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";
import { hasAdminRight, isAdminGodAccount } from "@/lib/admin-permissions";

const money = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatZar(amount: number): string {
  return `R${money.format(amount)}`;
}

export async function notifyFinanceAdmins(params: {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, adminRights: true },
  });

  await Promise.all(
    admins
      .filter(
        (admin) =>
          isAdminGodAccount(admin.email) ||
          hasAdminRight(admin.adminRights, "canManageFinance", {
            email: admin.email,
            isAdminRole: true,
          }),
      )
      .map((admin) =>
        notifyUser({
          userId: admin.id,
          type: params.type,
          title: params.title,
          body: params.body,
          metadata: params.metadata,
          email: {
            subject: params.title,
            text: params.body,
          },
        }),
      ),
  );
}

export async function notifyPayoutRequested(params: {
  payoutId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  amount: number;
}): Promise<void> {
  const label = params.userName?.trim() || params.userEmail || "A creator";
  await notifyFinanceAdmins({
    type: "PAYOUT_REQUESTED",
    title: "New payout request",
    body: `${label} requested a payout of ${formatZar(params.amount)}. Review it in Admin → Financial.`,
    metadata: {
      payoutId: params.payoutId,
      userId: params.userId,
      amount: params.amount,
      href: "/admin/financial",
    },
  });
}

export async function notifyPayoutApproved(params: {
  userId: string;
  amount: number;
  payoutId: string;
}): Promise<void> {
  await notifyUser({
    userId: params.userId,
    type: "PAYOUT_APPROVED",
    title: "Payout approved",
    body: `Your withdrawal of ${formatZar(params.amount)} was approved. We will transfer funds to your verified bank account shortly.`,
    metadata: { payoutId: params.payoutId, amount: params.amount },
    email: {
      subject: "Story Time — payout approved",
      text: `Your withdrawal of ${formatZar(params.amount)} was approved. We will transfer funds to your verified bank account shortly.`,
    },
  });
}

export async function notifyPayoutDeclined(params: {
  userId: string;
  amount: number;
  payoutId: string;
  reason: string;
}): Promise<void> {
  await notifyUser({
    userId: params.userId,
    type: "PAYOUT_DECLINED",
    title: "Payout declined",
    body: `Your withdrawal of ${formatZar(params.amount)} was declined. Reason: ${params.reason}. Funds were returned to your available balance.`,
    metadata: { payoutId: params.payoutId, amount: params.amount, reason: params.reason },
    email: {
      subject: "Story Time — payout declined",
      text: `Your withdrawal of ${formatZar(params.amount)} was declined.\n\nReason: ${params.reason}\n\nFunds were returned to your available balance.`,
    },
  });
}

export async function notifyPayoutPaid(params: {
  userId: string;
  amount: number;
  payoutId: string;
  proofReference?: string | null;
  proofUrl?: string | null;
}): Promise<void> {
  const proofLine = params.proofReference?.trim()
    ? `Payment reference: ${params.proofReference.trim()}`
    : params.proofUrl?.trim()
      ? `Proof: ${params.proofUrl.trim()}`
      : null;

  const body = [
    `Your withdrawal of ${formatZar(params.amount)} has been paid.`,
    proofLine,
    "Open your wallet to view the proof of payment.",
  ]
    .filter(Boolean)
    .join(" ");

  await notifyUser({
    userId: params.userId,
    type: "PAYOUT_PAID",
    title: "Payout completed",
    body,
    metadata: {
      payoutId: params.payoutId,
      amount: params.amount,
      proofReference: params.proofReference ?? null,
      proofUrl: params.proofUrl ?? null,
      href: "/creator/wallet",
    },
    email: {
      subject: "Story Time — payout completed",
      text: body,
    },
  });
}
