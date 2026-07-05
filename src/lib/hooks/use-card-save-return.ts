"use client";

import { useEffect } from "react";
import { stripCardSaveQueryParams } from "@/lib/payments/payfast-card-consent-client";

/** Refetch wallet/settings data after PayFast returns with ?card_saved=1. */
export function useCardSaveReturnRefresh(onReturned: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("card_saved") !== "1") return;

    onReturned();

    const nextSearch = stripCardSaveQueryParams(window.location.search);
    const nextUrl = `${window.location.pathname}${nextSearch}`;
    window.history.replaceState(null, "", nextUrl);
  }, [onReturned]);
}
