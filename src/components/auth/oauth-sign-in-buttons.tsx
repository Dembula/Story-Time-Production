"use client";

import { signIn } from "next-auth/react";
import { getEnabledOAuthProviders } from "@/lib/oauth-providers";

export function OAuthSignInButtons({
  callbackUrl,
  onError,
  variant = "dark",
  dividerLabel = "Or continue with",
}: {
  callbackUrl: string;
  onError?: (message: string) => void;
  variant?: "dark" | "light";
  dividerLabel?: string;
}) {
  const providers = getEnabledOAuthProviders();
  if (providers.length === 0) return null;

  const buttonClass =
    variant === "light"
      ? "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white"
      : "storytime-panel flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]";

  const gridClass =
    providers.length >= 3 ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid grid-cols-2 gap-3";

  async function handleSignIn(providerId: string, label: string) {
    try {
      await signIn(providerId, { callbackUrl });
    } catch {
      onError?.(`${label} sign-in is currently unavailable. Use email and password instead.`);
    }
  }

  return (
    <>
      <div className="relative my-6">
        <span className="absolute inset-0 flex items-center">
          <span className={`w-full border-t ${variant === "light" ? "border-slate-200" : "border-white/8"}`} />
        </span>
        <span
          className={`relative flex justify-center bg-transparent px-3 text-xs ${
            variant === "light" ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {dividerLabel}
        </span>
      </div>
      <div className={gridClass}>
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => void handleSignIn(provider.id, provider.label)}
            className={buttonClass}
          >
            {provider.label}
          </button>
        ))}
      </div>
    </>
  );
}
