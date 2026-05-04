const APP_BASE_URL = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";

export function buildPaymentReturnUrl(nextPath: string, flow: string) {
  const url = new URL("/payments/return", APP_BASE_URL);
  url.searchParams.set("next", nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
  url.searchParams.set("flow", flow);
  return url.toString();
}

