import { prisma } from "@/lib/prisma";

const db = prisma as unknown as {
  escrowAccount: {
    findUnique: (args: {
      where: { id: string };
      include: {
        buyerWallet: { select: { userId: true } };
        sellerWallet: { select: { userId: true } };
      };
    }) => Promise<{
      id: string;
      status: string;
      buyerWallet: { userId: string };
      sellerWallet: { userId: string };
    } | null>;
  };
};

export async function loadEscrowWithParties(escrowId: string) {
  return db.escrowAccount.findUnique({
    where: { id: escrowId },
    include: {
      buyerWallet: { select: { userId: true } },
      sellerWallet: { select: { userId: true } },
    },
  });
}

export function userIsEscrowParty(
  escrow: { buyerWallet: { userId: string }; sellerWallet: { userId: string } },
  userId: string,
  role: string,
): boolean {
  if (role === "ADMIN") return true;
  return (
    escrow.buyerWallet.userId === userId || escrow.sellerWallet.userId === userId
  );
}

/** Buyer confirms release; admin may override. */
export function userCanReleaseEscrow(
  escrow: { buyerWallet: { userId: string } },
  userId: string,
  role: string,
): boolean {
  if (role === "ADMIN") return true;
  return escrow.buyerWallet.userId === userId;
}
