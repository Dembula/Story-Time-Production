import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BillingAddressPayload = {
  residentialAddress?: string;
  city?: string;
  provinceState?: string;
  postalCode?: string;
  country?: string;
};

export async function upsertViewerBillingAddress(userId: string, address: BillingAddressPayload): Promise<void> {
  const normalized = {
    residentialAddress: address.residentialAddress?.trim() ?? "",
    city: address.city?.trim() ?? "",
    provinceState: address.provinceState?.trim() ?? "",
    postalCode: address.postalCode?.trim() ?? "",
    country: address.country?.trim() ?? "",
  };

  const pref = await prisma.userPreference.findUnique({ where: { userId } });
  const currentExtras = (pref?.profileExtras ?? {}) as Record<string, unknown>;
  const nextExtras = { ...currentExtras, accountAddress: normalized } as Prisma.InputJsonValue;

  if (pref) {
    await prisma.userPreference.update({
      where: { userId },
      data: { profileExtras: nextExtras },
    });
  } else {
    await prisma.userPreference.create({
      data: { userId, profileExtras: nextExtras },
    });
  }
}

export async function loadViewerBillingAddress(userId: string): Promise<BillingAddressPayload> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { profileExtras: true },
  });
  const address = (pref?.profileExtras as Record<string, unknown> | null)?.accountAddress as
    | Record<string, string>
    | undefined;
  return {
    residentialAddress: address?.residentialAddress ?? "",
    city: address?.city ?? "",
    provinceState: address?.provinceState ?? "",
    postalCode: address?.postalCode ?? "",
    country: address?.country ?? "",
  };
}

export async function upsertUserPreferences(
  userId: string,
  input: {
    theme?: string;
    accentColor?: string;
    notifyEmail?: boolean;
    playbackQuality?: string;
  },
) {
  const data: Record<string, unknown> = {};
  if (input.theme !== undefined) data.theme = input.theme;
  if (input.accentColor !== undefined) data.accentColor = input.accentColor;
  if (input.notifyEmail !== undefined) data.notifyEmail = input.notifyEmail;
  if (input.playbackQuality !== undefined) data.playbackQuality = input.playbackQuality;

  return prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
