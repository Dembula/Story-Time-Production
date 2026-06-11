import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  enforceCredentialSignInRateLimitWithEmail,
  isCredentialSignInRequest,
  isFailedCredentialSignInResponse,
  rateLimitedResponse,
  recordFailedCredentialSignIn,
} from "@/lib/auth-rate-limit";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const credentialSignIn = isCredentialSignInRequest(request.nextUrl.pathname);

  if (credentialSignIn) {
    const rate = await enforceCredentialSignInRateLimitWithEmail(request);
    if (!rate.allowed) {
      return rateLimitedResponse(rate.retryAfterSeconds, "Too many sign-in attempts. Try again later.");
    }
  }

  const response = await handler(request, context);

  if (credentialSignIn && (await isFailedCredentialSignInResponse(response))) {
    await recordFailedCredentialSignIn(request);
  }

  return response;
}
