import type { InputJsonValue } from "@/lib/prisma-json";
import { prisma } from "@/lib/prisma";

export type ViewerAccountOnboardingPayload = {
  name: string;
  email: string;
  phoneNumber: string;
  residentialAddress?: string;
  city?: string;
  provinceState?: string;
  postalCode?: string;
  country?: string;
};

export function isViewerAccountOnboardingComplete(user: {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  accountOnboardingCompletedAt?: Date | null;
}): boolean {
  if (user.accountOnboardingCompletedAt) return true;
  const name = user.name?.trim();
  const email = user.email?.trim();
  const phone = user.phoneNumber?.trim();
  return Boolean(name && email && phone);
}

export async function loadViewerOnboardingState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      accountOnboardingCompletedAt: true,
      userPreference: { select: { profileExtras: true } },
    },
  });
  if (!user) return null;

  const extras = (user.userPreference?.profileExtras ?? {}) as Record<string, unknown>;
  const address = (extras.accountAddress ?? {}) as Record<string, string>;

  return {
    complete: isViewerAccountOnboardingComplete(user),
    profile: {
      name: user.name ?? "",
      email: user.email ?? "",
      phoneNumber: user.phoneNumber ?? "",
      residentialAddress: address.residentialAddress ?? "",
      city: address.city ?? "",
      provinceState: address.provinceState ?? "",
      postalCode: address.postalCode ?? "",
      country: address.country ?? "",
    },
  };
}

export async function saveViewerAccountOnboardingDraft(
  userId: string,
  payload: Partial<ViewerAccountOnboardingPayload>,
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (payload.name?.trim()) data.name = payload.name.trim();
  if (payload.email?.trim()) {
    const email = payload.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true },
    });
    if (existing) throw new Error("That email is already used by another account.");
    data.email = email;
  }
  if (payload.phoneNumber?.trim()) data.phoneNumber = payload.phoneNumber.trim();

  const address = {
    residentialAddress: payload.residentialAddress?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    provinceState: payload.provinceState?.trim() ?? "",
    postalCode: payload.postalCode?.trim() ?? "",
    country: payload.country?.trim() ?? "",
  };

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: userId }, data });
    }

    const pref = await tx.userPreference.findUnique({ where: { userId } });
    const currentExtras = (pref?.profileExtras ?? {}) as Record<string, unknown>;
    const nextExtras = { ...currentExtras, accountAddress: address } as InputJsonValue;

    if (pref) {
      await tx.userPreference.update({
        where: { userId },
        data: { profileExtras: nextExtras },
      });
    } else {
      await tx.userPreference.create({
        data: { userId, profileExtras: nextExtras },
      });
    }
  });
}

export async function completeViewerAccountOnboarding(
  userId: string,
  payload: ViewerAccountOnboardingPayload,
): Promise<void> {
  const name = payload.name.trim();
  const email = payload.email.trim().toLowerCase();
  const phoneNumber = payload.phoneNumber.trim();

  if (!name || !email || !phoneNumber) {
    throw new Error("Full name, email, and phone number are required.");
  }

  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id: userId } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("That email is already used by another account.");
  }

  const address = {
    residentialAddress: payload.residentialAddress?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    provinceState: payload.provinceState?.trim() ?? "",
    postalCode: payload.postalCode?.trim() ?? "",
    country: payload.country?.trim() ?? "",
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phoneNumber,
        accountOnboardingCompletedAt: new Date(),
      },
    });

    const pref = await tx.userPreference.findUnique({ where: { userId } });
    const currentExtras = (pref?.profileExtras ?? {}) as Record<string, unknown>;
    const nextExtras = { ...currentExtras, accountAddress: address } as InputJsonValue;

    if (pref) {
      await tx.userPreference.update({
        where: { userId },
        data: { profileExtras: nextExtras },
      });
    } else {
      await tx.userPreference.create({
        data: { userId, profileExtras: nextExtras },
      });
    }
  });
}
