import sgMail from "@sendgrid/mail";
import { sendTransactionalEmail, sendTransactionalEmailDetailed } from "@/lib/email";
import { parseAppMailFrom } from "@/lib/mail-from";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Story Time <noreply@story-time.online>";

function sgMailFrom(): string | { email: string; name: string } {
  const { email, name } = parseAppMailFrom(EMAIL_FROM);
  return name ? { email, name } : email;
}

const WELCOME_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_WELCOME_ID || "";
const PASSWORD_RESET_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_PASSWORD_RESET_ID || "";
const MONTHLY_UPDATE_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_MONTHLY_UPDATE_ID || "";
/** Viewer signup → no package/payment reminder (SendGrid dynamic template). */
const REMINDER_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_REMINDER || "";
/** Viewer/company renewal payment failed (SendGrid dynamic template). */
const BILLING_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_BILLING || "";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function hasSendGridTemplateConfig(templateId: string): boolean {
  return Boolean(SENDGRID_API_KEY && templateId);
}

function portalLabelForRole(role?: string | null): string {
  if (!role || role === "SUBSCRIBER") return "Viewer";
  if (role === "ADMIN") return "Admin";
  return "Creator";
}

export async function sendWelcomeEmail(
  email: string,
  name?: string | null,
  account?: { role?: string | null; registrationType?: string }
): Promise<void> {
  const portal = portalLabelForRole(account?.role);
  const registrationType = account?.registrationType || (portal === "Creator" ? "creator" : "viewer");

  if (hasSendGridTemplateConfig(WELCOME_TEMPLATE_ID)) {
    await sgMail.send({
      to: email,
      from: sgMailFrom(),
      templateId: WELCOME_TEMPLATE_ID,
      dynamicTemplateData: {
        email,
        name: name || "",
        portal,
        registration_type: registrationType,
      },
    });
    return;
  }

  const sent = await sendTransactionalEmail({
    to: email,
    subject: `Welcome to Story Time (${portal} account)`,
    text: [
      `Hi ${name || "there"},`,
      "",
      "Welcome to Story Time.",
      `Your registration was created for the ${portal} portal.`,
      "",
      "If this was not you, please contact support immediately.",
    ].join("\n"),
    html: `
      <p>Hi ${name || "there"},</p>
      <p>Welcome to Story Time.</p>
      <p>Your registration was created for the <strong>${portal}</strong> portal.</p>
      <p>If this was not you, please contact support immediately.</p>
    `,
  });
  if (!sent) {
    throw new Error("Welcome email could not be sent (no working email transport or SendGrid rejected the request).");
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  extras?: { rawToken?: string; portal?: "viewer" | "creator" | "admin" },
): Promise<{ messageId?: string }> {
  const portalMatch = resetLink.match(/[?&]portal=([^&]+)/i);
  const portalRaw = extras?.portal || (portalMatch?.[1] ? decodeURIComponent(portalMatch[1]) : "");
  const portal =
    portalRaw === "creator" || portalRaw === "admin" || portalRaw === "viewer" ? portalRaw : "viewer";
  const portalLabel = portal === "admin" ? "Admin" : portal === "creator" ? "Creator" : "Viewer";
  const rawToken = extras?.rawToken ?? "";

  if (hasSendGridTemplateConfig(PASSWORD_RESET_TEMPLATE_ID)) {
    try {
      const [response] = await sgMail.send({
        to: email,
        from: sgMailFrom(),
        templateId: PASSWORD_RESET_TEMPLATE_ID,
        dynamicTemplateData: {
          email,
          reset_link: resetLink,
          reset_url: resetLink,
          reset_token: rawToken,
          token: rawToken,
          portal,
          portal_label: portalLabel,
        },
      });
      const messageId =
        (response?.headers?.["x-message-id"] as string | undefined) ||
        (response?.headers?.["X-Message-Id"] as string | undefined);
      return { messageId };
    } catch (templateError) {
      // Reset delivery is critical; fall back to transactional email if template send fails.
      console.error("Password reset template send failed, retrying with transactional fallback:", templateError);
    }
  }

  const sent = await sendTransactionalEmailDetailed({
    to: email,
    subject: "Story Time password reset",
    text: [
      "We received a request to reset your password.",
      `Account portal: ${portalLabel}`,
      "Use this secure link to create a new password:",
      resetLink,
      "",
      "This link expires in 1 hour and can only be used once.",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>We received a request to reset your password.</p>
      <p>Account portal: <strong>${portalLabel}</strong></p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p style="word-break:break-all;font-size:12px;color:#666;">Or paste this link into your browser:<br/>${resetLink}</p>
      <p>This link expires in 1 hour and can only be used once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
  if (!sent.ok) {
    throw new Error(
      sent.error ||
        "Password reset email could not be sent (no working email transport or provider rejected the request).",
    );
  }
  return { messageId: sent.messageId };
}

export async function sendMonthlyUpdateEmail(
  emailList: string[],
  content: {
    subject?: string;
    preview?: string;
    body?: string;
    latestReleases?: Array<{ title: string; type?: string | null; creatorName?: string | null }>;
    creatorHighlights?: Array<{ name: string; role?: string | null }>;
  }
): Promise<void> {
  const uniqueEmails = [...new Set(emailList.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!uniqueEmails.length) return;

  const subject = content.subject || "Story Time Monthly Update";
  const lines = [
    content.preview || "",
    content.body || "",
    "",
    ...(content.latestReleases?.length
      ? ["Latest releases:", ...content.latestReleases.map((x) => `- ${x.title}${x.creatorName ? ` by ${x.creatorName}` : ""}`)]
      : []),
    ...(content.creatorHighlights?.length
      ? ["", "Creator highlights:", ...content.creatorHighlights.map((x) => `- ${x.name}${x.role ? ` (${x.role})` : ""}`)]
      : []),
  ].filter(Boolean);
  const plainTextBody = lines.join("\n");

  const dynamicForRecipient = (email: string) => ({
    email,
    subject: content.subject || "",
    preview: content.preview || "",
    body: content.body || "",
    latest_releases: content.latestReleases || [],
    creator_highlights: content.creatorHighlights || [],
  });

  if (hasSendGridTemplateConfig(MONTHLY_UPDATE_TEMPLATE_ID)) {
    const BATCH_SIZE = 100;
    async function sendOneTemplateRecipient(email: string): Promise<void> {
      try {
        await sgMail.send({
          to: email,
          from: sgMailFrom(),
          templateId: MONTHLY_UPDATE_TEMPLATE_ID,
          dynamicTemplateData: dynamicForRecipient(email),
        });
      } catch (singleTemplateErr) {
        console.error(`Monthly dynamic template failed for ${email}; sending plaintext fallback:`, singleTemplateErr);
        const ok = await sendTransactionalEmail({
          to: email,
          subject,
          text: plainTextBody,
        });
        if (!ok) {
          throw new Error(`Monthly update could not be sent to ${email} (template and plaintext both failed).`);
        }
      }
    }

    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
      try {
        await sgMail.send({
          personalizations: batch.map((email) => ({
            to: [{ email }],
            dynamicTemplateData: dynamicForRecipient(email),
          })),
          from: sgMailFrom(),
          templateId: MONTHLY_UPDATE_TEMPLATE_ID,
        });
      } catch (batchErr) {
        console.error("SendGrid monthly update batch failed; retrying that batch per recipient:", batchErr);
        for (const email of batch) {
          await sendOneTemplateRecipient(email);
        }
      }
    }
    return;
  }

  for (const email of uniqueEmails) {
    const ok = await sendTransactionalEmail({
      to: email,
      subject,
      text: plainTextBody,
    });
    if (!ok) {
      throw new Error(`Monthly update could not be sent to ${email} (no working email transport or SendGrid rejected the request).`);
    }
  }
}

export type ViewerPackageReminderContent = {
  name?: string | null;
  packageUrl?: string;
};

/**
 * Reminder for viewers who registered but have not chosen/paid for a package.
 * Uses SENDGRID_TEMPLATE_REMINDER when configured.
 */
export async function sendViewerPackageReminderEmail(
  email: string,
  content?: ViewerPackageReminderContent,
): Promise<void> {
  const to = email.trim().toLowerCase();
  if (!to) return;

  const name = content?.name?.trim() || "";
  const packageUrl =
    content?.packageUrl?.trim() ||
    "https://story-time.online/onboarding/package";

  if (hasSendGridTemplateConfig(REMINDER_TEMPLATE_ID)) {
    await sgMail.send({
      to,
      from: sgMailFrom(),
      templateId: REMINDER_TEMPLATE_ID,
      dynamicTemplateData: {
        email: to,
        name,
        first_name: name.split(/\s+/)[0] || name,
        package_url: packageUrl,
        package_link: packageUrl,
        cta_url: packageUrl,
      },
    });
    return;
  }

  const sent = await sendTransactionalEmail({
    to,
    subject: "Finish setting up your Story Time subscription",
    text: [
      `Hi ${name || "there"},`,
      "",
      "You signed up for Story Time but have not chosen a viewing package yet.",
      "Pick a plan to unlock the catalogue:",
      packageUrl,
      "",
      "If you already subscribed, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Hi ${name || "there"},</p>
      <p>You signed up for Story Time but have not chosen a viewing package yet.</p>
      <p><a href="${packageUrl}">Choose your package</a></p>
      <p>If you already subscribed, you can ignore this email.</p>
    `,
  });
  if (!sent) {
    throw new Error(
      "Viewer package reminder could not be sent (no working email transport or SendGrid rejected the request).",
    );
  }
}

export type BillingFailureEmailContent = {
  name?: string | null;
  billingUrl?: string;
  errorMessage?: string | null;
};

/**
 * Sent when an automatic renewal charge fails.
 * Uses SENDGRID_TEMPLATE_BILLING when configured.
 */
export async function sendBillingFailureEmail(
  email: string,
  content?: BillingFailureEmailContent,
): Promise<void> {
  const to = email.trim().toLowerCase();
  if (!to) return;

  const name = content?.name?.trim() || "";
  const billingUrl =
    content?.billingUrl?.trim() || "https://story-time.online/browse/account";
  const errorMessage = content?.errorMessage?.trim() || "";

  if (hasSendGridTemplateConfig(BILLING_TEMPLATE_ID)) {
    await sgMail.send({
      to,
      from: sgMailFrom(),
      templateId: BILLING_TEMPLATE_ID,
      dynamicTemplateData: {
        email: to,
        name,
        first_name: name.split(/\s+/)[0] || name,
        billing_url: billingUrl,
        billing_link: billingUrl,
        account_url: billingUrl,
        cta_url: billingUrl,
        error_message: errorMessage,
        payment_error: errorMessage,
      },
    });
    return;
  }

  const sent = await sendTransactionalEmail({
    to,
    subject: "Story Time — we could not renew your subscription",
    text: [
      `Hi ${name || "there"},`,
      "",
      "We tried to renew your Story Time subscription but the payment did not go through.",
      errorMessage ? `Details: ${errorMessage}` : "",
      "Update your card or pay from your account to keep access:",
      billingUrl,
      "",
      "If you already paid, you can ignore this email.",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <p>Hi ${name || "there"},</p>
      <p>We tried to renew your Story Time subscription but the payment did not go through.</p>
      ${errorMessage ? `<p>${errorMessage}</p>` : ""}
      <p><a href="${billingUrl}">Update billing</a></p>
      <p>If you already paid, you can ignore this email.</p>
    `,
  });
  if (!sent) {
    throw new Error(
      "Billing failure email could not be sent (no working email transport or SendGrid rejected the request).",
    );
  }
}
