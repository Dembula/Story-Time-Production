import sgMail from "@sendgrid/mail";
import { sendTransactionalEmail } from "@/lib/email";
import { parseAppMailFrom } from "@/lib/mail-from";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@story-time.online";

function sgMailFrom(): string | { email: string; name: string } {
  const { email, name } = parseAppMailFrom(EMAIL_FROM);
  return name ? { email, name } : email;
}

const WELCOME_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_WELCOME_ID || "";
const PASSWORD_RESET_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_PASSWORD_RESET_ID || "";
const MONTHLY_UPDATE_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_MONTHLY_UPDATE_ID || "";

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

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const portalMatch = resetLink.match(/[?&]portal=([^&]+)/i);
  const portalRaw = portalMatch?.[1] ? decodeURIComponent(portalMatch[1]) : "";
  const portal =
    portalRaw === "creator" || portalRaw === "admin" || portalRaw === "viewer" ? portalRaw : "viewer";
  const portalLabel = portal === "admin" ? "Admin" : portal === "creator" ? "Creator" : "Viewer";

  if (hasSendGridTemplateConfig(PASSWORD_RESET_TEMPLATE_ID)) {
    await sgMail.send({
      to: email,
      from: sgMailFrom(),
      templateId: PASSWORD_RESET_TEMPLATE_ID,
      dynamicTemplateData: {
        email,
        reset_link: resetLink,
        portal,
        portal_label: portalLabel,
      },
    });
    return;
  }

  const sent = await sendTransactionalEmail({
    to: email,
    subject: "Story Time password reset",
    text: [
      "We received a request to reset your password.",
      `Account portal: ${portalLabel}`,
      "Use this secure link to create a new password:",
      resetLink,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>We received a request to reset your password.</p>
      <p>Account portal: <strong>${portalLabel}</strong></p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
  if (!sent) {
    throw new Error("Password reset email could not be sent (no working email transport or SendGrid rejected the request).");
  }
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
