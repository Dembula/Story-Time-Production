"use client";

import Image from "next/image";
import { LandingReveal } from "@/components/landing/LandingReveal";

const APP_STORE_URL = "https://apps.apple.com/za/app/story-time-universe/id6792273306";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.storytime.universe&pcampaignid=web_share";

const stores = [
  {
    href: PLAY_STORE_URL,
    label: "Get it on Google Play",
    src: "/badges/google-play.svg",
  },
  {
    href: APP_STORE_URL,
    label: "Download on the App Store",
    src: "/badges/app-store.svg",
  },
] as const;

/**
 * First section after the landing hero — store download CTAs for mobile scroll.
 */
export function LandingAvailableOn() {
  return (
    <section
      id="available-on"
      aria-labelledby="available-on-heading"
      className="relative border-t border-white/8 px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,162,44,0.06),transparent_62%)]" />
      <div className="relative mx-auto max-w-6xl">
        <LandingReveal className="mx-auto flex max-w-xl flex-col items-center text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-orange-300/80">
            Watch anywhere
          </p>
          <h2
            id="available-on-heading"
            className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            Available on
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400 sm:text-base">
            Stream Story Time Universe on your phone — African stories, ready whenever you are.
          </p>

          <div className="mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            {stores.map((store) => (
              <a
                key={store.href}
                href={store.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex justify-center rounded-xl transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70"
                aria-label={store.label}
              >
                <Image
                  src={store.src}
                  alt={store.label}
                  width={180}
                  height={54}
                  className="h-12 w-auto sm:h-14"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
