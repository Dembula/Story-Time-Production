import sgMail from "@sendgrid/mail";
import { sendTransactionalEmail } from "@/lib/email";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@story-time.online";

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
      from: EMAIL_FROM,
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

  await sendTransactionalEmail({
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
      from: EMAIL_FROM,
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

  await sendTransactionalEmail({
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
  if (!emailList.length) return;

  if (hasSendGridTemplateConfig(MONTHLY_UPDATE_TEMPLATE_ID)) {
    const BATCH_SIZE = 250;
    for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
      const batch = emailList.slice(i, i + BATCH_SIZE);
      await sgMail.send({
        personalizations: batch.map((email) => ({
          to: [{ email }],
          dynamicTemplateData: {
            email,
            subject: content.subject || "",
            preview: content.preview || "",
            body: content.body || "",
            latest_releases: content.latestReleases || [],
            creator_highlights: content.creatorHighlights || [],
          },
        })),
        from: EMAIL_FROM,
        templateId: MONTHLY_UPDATE_TEMPLATE_ID,
      });
    }
    return;
  }

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

  for (const email of emailList) {
    await sendTransactionalEmail({
      to: email,
      subject,
      text: lines.join("\n"),
    });
  }
}
