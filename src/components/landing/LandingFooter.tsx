import Link from "next/link";
import { PlaybackComplianceBadge } from "@/components/player/playback-compliance-badge";
import { StoryTimeMark } from "@/components/brand/story-time-mark";

const policyLinkClass =
  "inline-flex items-center whitespace-nowrap rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] leading-4 text-slate-500 transition hover:border-white/20 hover:text-slate-200";

const policyLinks = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/regulatory-framework", label: "Regulatory Framework" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/payment-policy", label: "Payment Policy" },
  { href: "/legal/refund-policy", label: "Refund Policy" },
  { href: "/legal/subscription-terms", label: "Subscription Terms" },
  { href: "/legal/content-policy", label: "Content Policy" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal/acceptable-use", label: "Acceptable Use" },
  { href: "/legal/paia-manual", label: "PAIA Manual" },
  { href: "/legal/security-policy", label: "Security Policy" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/copyright", label: "Copyright" },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-white/8 px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="flex flex-col items-center gap-2 md:items-start" aria-label="Story Time home">
            <StoryTimeMark size={32} />
            <span className="text-[10px] tracking-wide text-slate-500">STORYTIME STUDIOS (Pty) Ltd · 2026/269060/07</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
            <Link href="/auth/signin" className="hover:text-white">Sign In</Link>
            <Link href="/auth/creator/signin" className="hover:text-white">Creator Portal</Link>
            <Link href="/auth/admin" className="hover:text-white">Admin</Link>
          </div>
          <PlaybackComplianceBadge variant="footer" />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-white/8 pt-6">
          <Link
            href="/about"
            className="inline-flex items-center whitespace-nowrap rounded-md border border-orange-400/40 bg-orange-500/15 px-2 py-0.5 text-[11px] leading-4 text-orange-200 transition hover:border-orange-300 hover:bg-orange-500/25 hover:text-orange-100"
          >
            About Us
          </Link>
          {policyLinks.map((link) => (
            <Link key={link.href} href={link.href} className={policyLinkClass}>
              {link.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-600">&copy; {new Date().getFullYear()} Story Time. All rights reserved. STORYTIME STUDIOS (Pty) Ltd (CIPC 2026/269060/07)</p>
      </div>
    </footer>
  );
}
