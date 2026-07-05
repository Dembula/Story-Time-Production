import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import {
  finalizeFundingDealWalletPayment,
  resolveFundingDealSettlement,
} from "@/lib/payments/funding-deal-settlement";

interface Params {
  params: Promise<{ dealId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await params;
  const body = (await req.json().catch(() => ({}))) as { amount?: number };

  const resolved = await resolveFundingDealSettlement(dealId, userId, body.amount);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const quote = resolved.quote;
  const walletResult = await finalizeFundingDealWalletPayment(quote);
  if (walletResult.ok) {
    return NextResponse.json({
      success: true,
      requiresPayment: false,
      mode: "wallet",
      transactionId: walletResult.transactionId,
      paymentId: walletResult.paymentId,
      baseAmount: walletResult.baseAmount,
      feeAmount: walletResult.feeAmount,
      totalAmount: walletResult.totalAmount,
      message: "Investment funded through Story Time wallet.",
    });
  }

  try {
    const { checkout, paymentRecord } = await initializeCheckout({
      userId,
      email: session?.user?.email,
      customerName: session?.user?.name,
      amount: quote.totalAmount,
      purpose: quote.purpose,
      referenceType: "InvestmentDeal",
      referenceId: dealId,
      returnUrl: buildPaymentReturnUrl("/funders/deals", `investment_${dealId}`),
      metadata: {
        investmentDeal: true,
        baseAmount: quote.baseAmount,
        feeAmount: quote.feeAmount,
      },
    });

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      mode: "gateway",
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: paymentRecord.id,
      baseAmount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      totalAmount: quote.totalAmount,
      walletHint: walletResult.error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 502 },
    );
  }
}
