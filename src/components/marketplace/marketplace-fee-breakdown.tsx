import { formatZar } from "@/lib/format-currency-zar";

export function MarketplaceFeeBreakdown({
  baseAmount,
  feeAmount,
  totalAmount,
  className,
}: {
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  className?: string;
}) {
  return (
    <p className={className ?? "text-xs text-slate-400 mt-2"}>
      Checkout: {formatZar(baseAmount)} + fee {formatZar(feeAmount)} ={" "}
      <span className="text-orange-300 font-medium">{formatZar(totalAmount)}</span> (wallet or PayFast)
    </p>
  );
}
