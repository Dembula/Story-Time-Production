import nodemailer from "nodemailer";
import { formatAppMailFromHeader, parseAppMailFrom } from "@/lib/mail-from";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  ok: boolean;
  provider?: "sendgrid" | "resend" | "nodemailer";
  messageId?: string;
  error?: string;
};

export function isEmailTransportConfigured(): boolean {
  if (process.env.SENDGRID_API_KEY?.trim()) return true;
  if (process.env.RESEND_API_KEY?.trim()) return true;
  const raw = process.env.EMAIL_SERVER?.trim();
  return Boolean(raw && !raw.includes("localhost"));
}

async function sendViaSendGrid(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "SENDGRID_API_KEY not set" };

  const parsedFrom = parseAppMailFrom();
  const sendGridFrom = parsedFrom.name
    ? { email: parsedFrom.email, name: parsedFrom.name }
    : { email: parsedFrom.email };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sendGridFrom,
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
    return { ok: false, provider: "sendgrid", error: `SendGrid ${res.status}: ${err.slice(0, 400)}` };
  }

  const messageId =
    res.headers.get("x-message-id") || res.headers.get("X-Message-Id") || undefined;
  return { ok: true, provider: "sendgrid", messageId };
}

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const parsedFrom = parseAppMailFrom();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatAppMailFromHeader(parsedFrom),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("Resend email failed:", res.status, err);
    return { ok: false, provider: "resend", error: `Resend ${res.status}: ${err.slice(0, 400)}` };
  }

  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, provider: "resend", messageId: body?.id };
}

async function sendViaNodemailer(input: SendEmailInput): Promise<SendEmailResult> {
  const raw = process.env.EMAIL_SERVER?.trim();
  if (!raw || raw.includes("localhost")) {
    return { ok: false, error: "EMAIL_SERVER not configured for outbound mail" };
  }

  try {
    let transportOpts: Parameters<typeof nodemailer.createTransport>[0] | string;
    try {
      transportOpts = JSON.parse(raw) as Exclude<typeof transportOpts, string>;
    } catch {
      transportOpts = raw;
    }
    const transporter = nodemailer.createTransport(transportOpts);
    const parsedFrom = parseAppMailFrom();
    const info = await transporter.sendMail({
      from: formatAppMailFromHeader(parsedFrom),
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return {
      ok: true,
      provider: "nodemailer",
      messageId: typeof info.messageId === "string" ? info.messageId : undefined,
    };
  } catch (e) {
    console.error("Nodemailer send failed:", e);
    return {
      ok: false,
      provider: "nodemailer",
      error: e instanceof Error ? e.message : "Nodemailer send failed",
    };
  }
}

/**
 * Transactional email with provider fallbacks:
 * SendGrid → Resend → nodemailer (EMAIL_SERVER).
 * Returns detailed result; use sendTransactionalEmail for boolean callers.
 */
export async function sendTransactionalEmailDetailed(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "Invalid recipient email" };
  }

  const attempts: SendEmailResult[] = [];

  if (process.env.SENDGRID_API_KEY?.trim()) {
    const result = await sendViaSendGrid(input);
    if (result.ok) return result;
    attempts.push(result);
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    const result = await sendViaResend(input);
    if (result.ok) return result;
    attempts.push(result);
  }

  const smtp = await sendViaNodemailer(input);
  if (smtp.ok) return smtp;
  attempts.push(smtp);

  if (!isEmailTransportConfigured()) {
    return {
      ok: false,
      error: "No email transport configured (set SENDGRID_API_KEY, RESEND_API_KEY, or EMAIL_SERVER).",
    };
  }

  const detail = attempts
    .map((a) => a.error)
    .filter(Boolean)
    .join(" | ");
  return { ok: false, error: detail || "All email transports failed" };
}

/**
 * Transactional email. Uses SendGrid, then Resend, then nodemailer + EMAIL_SERVER.
 * Returns false if nothing was sent (no config / all providers failed).
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<boolean> {
  const result = await sendTransactionalEmailDetailed(input);
  return result.ok;
}
