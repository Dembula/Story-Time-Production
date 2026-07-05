import { prisma } from "@/lib/prisma";
import { parseCateringCompanyProfile } from "@/lib/company-marketplace-profiles";
import { buildCateringPayQuote, computeCateringBaseZar } from "@/lib/catering-pricing";

type CateringBookingWithCompany = {
  id: string;
  status: string;
  headCount: number | null;
  quotedAmount: number | null;
  paymentTransactionId: string | null;
  cateringCompany: {
    minOrder: number | null;
    description: string | null;
    logoUrl?: string | null;
  };
};

export function enrichCateringBookingForClient<T extends CateringBookingWithCompany>(booking: T) {
  const profile = parseCateringCompanyProfile(booking.cateringCompany);
  const baseAmount =
    booking.status === "APPROVED" && !booking.paymentTransactionId
      ? computeCateringBaseZar({
          quotedAmount: booking.quotedAmount,
          pricePerHead: profile.pricePerHead,
          headCount: booking.headCount,
          minOrder: booking.cateringCompany.minOrder ?? profile.minOrder,
        })
      : booking.quotedAmount ?? null;

  const payQuote =
    typeof baseAmount === "number" && baseAmount > 0 ? buildCateringPayQuote(baseAmount) : null;

  return {
    ...booking,
    quotedAmount: booking.quotedAmount,
    payQuote,
  };
}

export async function resolveCateringQuotedAmountForApproval(
  bookingId: string,
  quotedAmountOverride?: number | null,
) {
  const booking = await prisma.cateringBooking.findUnique({
    where: { id: bookingId },
    include: { cateringCompany: true },
  });
  if (!booking) return null;

  const profile = parseCateringCompanyProfile(booking.cateringCompany);
  if (quotedAmountOverride != null && quotedAmountOverride > 0) {
    return Math.round(quotedAmountOverride * 100) / 100;
  }

  return computeCateringBaseZar({
    pricePerHead: profile.pricePerHead,
    headCount: booking.headCount,
    minOrder: booking.cateringCompany.minOrder ?? profile.minOrder,
  });
}
