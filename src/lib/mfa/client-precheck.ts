export type MfaPrecheckPortal = "viewer" | "creator" | "admin";

export type MfaPrecheckResult =
  | { ok: true; mfaRequired: boolean }
  | { ok: false; mfaRequired: false; error?: string };

/** Ask the server whether MFA is required after a successful password for this portal. */
export async function precheckMfaRequirement(args: {
  email: string;
  password: string;
  portal: MfaPrecheckPortal;
  selectedRole?: string;
}): Promise<MfaPrecheckResult> {
  const res = await fetch("/api/auth/mfa/precheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: args.email.trim().toLowerCase(),
      password: args.password,
      portal: args.portal,
      selectedRole: args.selectedRole,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    mfaRequired?: boolean;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, mfaRequired: false, error: data.error || "Could not verify sign-in." };
  }
  if (!data.ok) {
    return { ok: false, mfaRequired: false };
  }
  return { ok: true, mfaRequired: Boolean(data.mfaRequired) };
}
