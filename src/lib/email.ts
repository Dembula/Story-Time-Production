import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Transactional email. Uses RESEND_API_KEY (REST) when set, else nodemailer + EMAIL_SERVER / EMAIL_FROM (same idea as NextAuth EmailProvider).
 * Returns false if nothing was sent (no config / skipped).
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<boolean> {
  const from = process.env.EMAIL_FROM || "noreply@storytime.com";

  if (process.env.SENDGRID_API_KEY) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: from },
        personalizations: [{ to: [{ email: input.to }] }],
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.text },
          ...(input.html ? [{ type: "text/html", value: input.html }] : []),
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("SendGrid email failed:", res.status, err);
      return false;
    }
    return true;
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("Resend email failed:", res.status, err);
      return false;
    }
    return true;
  }

  const raw = process.env.EMAIL_SERVER;
  if (!raw || raw.includes("localhost")) {
    return false;
  }

  try {
    let transportOpts: Parameters<typeof nodemailer.createTransport>[0] | string;
    try {
      transportOpts = JSON.parse(raw) as Exclude<typeof transportOpts, string>;
    } catch {
      transportOpts = raw;
    }
    const transporter = nodemailer.createTransport(transportOpts);
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return true;
  } catch (e) {
    console.error("Nodemailer send failed:", e);
    return false;
  }
}
