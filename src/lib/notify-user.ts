import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";

export type NotifyUserParams = {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** If set, sends email when user has email and notifyEmail preference is not false */
  email?: { subject: string; text: string };
};

export async function notifyUser(params: NotifyUserParams): Promise<void> {
  const metadata =
    params.metadata && Object.keys(params.metadata).length > 0
      ? JSON.stringify(params.metadata)
      : null;

  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata,
    },
  });

  if (!params.email) return;

  const pref = await prisma.userPreference.findUnique({
    where: { userId: params.userId },
    select: { notifyEmail: true },
  });
  if (pref && pref.notifyEmail === false) return;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (!user?.email) return;

  await sendTransactionalEmail({
    to: user.email,
    subject: params.email.subject,
    text: params.email.text,
  });
}
