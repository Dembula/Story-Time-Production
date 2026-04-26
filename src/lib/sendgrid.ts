import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@story-time.online";

const WELCOME_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_WELCOME_ID || "";
const PASSWORD_RESET_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_PASSWORD_RESET_ID || "";
const MONTHLY_UPDATE_TEMPLATE_ID = process.env.SENDGRID_TEMPLATE_MONTHLY_UPDATE_ID || "";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function ensureSendGridConfigured(templateId: string) {
  if (!SENDGRID_API_KEY) {
    throw new Error("Missing SENDGRID_API_KEY.");
  }
  if (!templateId) {
    throw new Error("Missing SendGrid dynamic template ID.");
  }
}

export async function sendWelcomeEmail(email: string, name?: string | null): Promise<void> {
  ensureSendGridConfigured(WELCOME_TEMPLATE_ID);
  await sgMail.send({
    to: email,
    from: EMAIL_FROM,
    templateId: WELCOME_TEMPLATE_ID,
    dynamicTemplateData: {
      email,
      name: name || "",
    },
  });
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  ensureSendGridConfigured(PASSWORD_RESET_TEMPLATE_ID);
  await sgMail.send({
    to: email,
    from: EMAIL_FROM,
    templateId: PASSWORD_RESET_TEMPLATE_ID,
    dynamicTemplateData: {
      email,
      reset_link: resetLink,
    },
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
  ensureSendGridConfigured(MONTHLY_UPDATE_TEMPLATE_ID);
  if (!emailList.length) return;

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
}
