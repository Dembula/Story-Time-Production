export type OAuthProviderId = "google" | "github" | "apple";

export type OAuthProviderOption = {
  id: OAuthProviderId;
  label: string;
};

/** Client-side list of OAuth providers enabled via env (see next.config.ts). */
export function getEnabledOAuthProviders(): OAuthProviderOption[] {
  const providers: OAuthProviderOption[] = [];
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true") {
    providers.push({ id: "google", label: "Google" });
  }
  if (process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "true") {
    providers.push({ id: "github", label: "GitHub" });
  }
  if (process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true") {
    providers.push({ id: "apple", label: "Apple" });
  }
  return providers;
}
