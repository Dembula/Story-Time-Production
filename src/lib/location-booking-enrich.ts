import { computeLocationBookingBaseZar } from "@/lib/financial-ledger";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";

export function buildLocationPayQuote(baseAmount: number) {
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;
  return { baseAmount, feeAmount, totalAmount };
}

type LocationBookingRow = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  paymentTransactionId: string | null;
  location: { dailyRate: number | null };
};

export function enrichLocationBookingForClient<T extends LocationBookingRow>(booking: T) {
  const baseAmount =
    booking.status === "APPROVED" && !booking.paymentTransactionId
      ? computeLocationBookingBaseZar({
          dailyRate: booking.location.dailyRate,
          startDate: booking.startDate,
          endDate: booking.endDate,
        })
      : null;

  const payQuote =
    typeof baseAmount === "number" && baseAmount > 0 ? buildLocationPayQuote(baseAmount) : null;

  return { ...booking, payQuote };
}
