import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const paymentRecordId = process.argv[2];

if (!paymentRecordId) {
  console.error("Usage: node scripts/monitor-payment.mjs <paymentRecordId>");
  process.exit(1);
}

async function main() {
  let last = "";
  const started = Date.now();
  while (Date.now() - started < 10 * 60 * 1000) {
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: paymentRecordId },
      select: {
        id: true,
        status: true,
        paidAt: true,
        userId: true,
        updatedAt: true,
      },
    });
    if (!payment) {
      console.log("missing payment record");
      return;
    }
    const wallet = payment.userId
      ? await prisma.wallet.findUnique({
          where: { userId: payment.userId },
          select: {
            availableBalance: true,
            pendingBalance: true,
            lockedBalance: true,
            totalEarnings: true,
            totalWithdrawn: true,
          },
        })
      : null;
    const incomingPaymentEntries = await prisma.ledgerEntry.count({
      where: { transactionType: "incoming_payment", userId: payment.userId ?? undefined },
    });
    const latestEvents = await prisma.gatewayEvent.findMany({
      where: { provider: "STITCH" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { eventType: true, processed: true, createdAt: true },
    });
    const line = JSON.stringify({
      status: payment.status,
      paidAt: payment.paidAt,
      updatedAt: payment.updatedAt,
      wallet,
      incomingPaymentEntries,
      latestEvents,
    });
    if (line !== last) {
      console.log(new Date().toISOString(), line);
      last = line;
    }
    if (payment.status === "SUCCEEDED") {
      console.log("PAYMENT_SUCCEEDED");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

