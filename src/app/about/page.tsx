import Link from "next/link";
import { StoryTimeMark } from "@/components/brand/story-time-mark";

const sections = [
  {
    title: "Who we are",
    paragraphs: [
      "STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07) operates Story Time (story-time.online), a South African digital entertainment and production platform that connects audiences with story-based content and gives creators tools to publish, distribute, and monetize their work.",
      "We build secure, scalable infrastructure for streaming, creator workflows, marketplace collaboration, and compliant payment processing under South African law.",
    ],
  },
  {
    title: "What Story Time offers",
    paragraphs: [
      "Viewers can browse and watch free and premium storytelling experiences, manage age-aware profiles, and subscribe to unlock catalogue access.",
      "Creators and production stakeholders can upload projects, manage metadata and ratings, collaborate through marketplace tools (including equipment, locations, crew, casting, and catering), and participate in monetization subject to platform terms.",
    ],
  },
  {
    title: "Creator monetization",
    paragraphs: [
      "Creators may earn through paid access, subscriptions to exclusive content, and platform-supported revenue models where available.",
      "STORYTIME STUDIOS (Pty) Ltd may retain a disclosed service fee or commission for facilitating transactions. Earnings are subject to payout timelines, verification requirements, and applicable deductions as set out in product flows and legal terms.",
    ],
  },
  {
    title: "Payments and pricing transparency",
    paragraphs: [
      "Prices are shown before checkout. Subscription cycles, recurring charges, and one-time fees are disclosed prior to payment. We do not add hidden fees without consent.",
      "Web payments are processed through licensed gateways such as PayFast. Story Time does not intentionally store full card PAN or CVV. Processor terms and card-network rules also apply to each transaction.",
    ],
  },
  {
    title: "Refunds, disputes, and support",
    paragraphs: [
      "Refund eligibility is governed by our Refund Policy and applicable consumer law, including the Consumer Protection Act where relevant. We ask users to contact support before initiating chargebacks so we can investigate quickly.",
      "Customer support: +27 61 657 2691 | support@story-time.online. We aim to respond within a reasonable timeframe consistent with our service standards.",
    ],
  },
  {
    title: "Privacy, stores, and account control",
    paragraphs: [
      "Our Privacy Policy explains what we collect, why we use it, and how you can exercise POPIA rights. Signed-in users can export their data and permanently delete their account from in-product Privacy & account control settings, aligned with Apple App Store Guideline 5.1.1(v) and Google Play User Data policy (including an external web / support deletion pathway).",
      "Where Sign in with Apple, Google, or other OAuth providers are enabled, authentication data is handled under our Privacy Policy and the provider’s terms. Store-billed purchases on Apple, Google Play, Amazon, or TV platforms follow the relevant store’s billing rules in addition to our Payment and Subscription Terms.",
    ],
  },
  {
    title: "Onboarding and consent",
    paragraphs: [
      "Users create an account, review and accept the Terms of Service and Privacy Policy, review pricing where applicable, and then complete secure checkout for paid features.",
      "No paid activation proceeds without disclosure of the commercial terms that apply to the selected plan or purchase.",
    ],
  },
  {
    title: "Compliance posture",
    paragraphs: [
      "Story Time is operated with regard to POPIA, ECTA, the CPA, PAIA, the Cybercrimes Act, applicable intellectual-property law, payment-partner requirements, and major app-distributor expectations (Apple, Google Play, Amazon Appstore, and connected-TV platforms).",
      "We maintain transparent billing practices, content moderation standards, security controls, and enforcement of acceptable use to protect audiences, creators, and partners.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-black/90 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="shrink-0" aria-label="Story Time home">
            <StoryTimeMark size={32} />
          </Link>
          <div className="flex items-center gap-3 text-xs sm:gap-4 sm:text-sm">
            <Link href="/legal/terms" className="text-slate-400 transition hover:text-slate-200">
              Legal
            </Link>
            <Link href="/" className="text-slate-500 transition hover:text-slate-300">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10 md:py-12">
        <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 shadow-panel sm:rounded-[32px] sm:p-6 md:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">
              About Story Time
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              About STORYTIME STUDIOS (Pty) Ltd
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300 break-words md:text-base md:leading-7">
              How Story Time operates, how creators and audiences engage with free and
              paid services, and how privacy, payment, and support commitments are
              applied across the platform.
            </p>
            <p className="text-xs text-slate-500">Last updated: July 2026</p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
          {sections.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/8 bg-zinc-950/60 p-4 shadow-panel sm:rounded-3xl sm:p-6"
            >
              <h2 className="mb-2 text-lg font-semibold text-white sm:mb-3 sm:text-xl">{item.title}</h2>
              <div className="space-y-3 break-words text-sm leading-relaxed text-slate-300 sm:leading-7">
                {item.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-400 sm:mt-6 sm:rounded-3xl sm:p-6 sm:leading-7">
          <p>
            STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07)
            maintains a unified legal suite covering Terms of Service, Privacy Policy,
            Payment Policy, Refund Policy, Subscription Terms, Content Policy, Cookie
            Policy, Acceptable Use Policy, PAIA Manual, Security Policy, Copyright
            Notice, Disclaimer, and Regulatory Framework disclosures.
          </p>
          <p className="mt-3">
            Contact: support@story-time.online | +27 61 657 2691
          </p>
        </section>
      </main>
    </div>
  );
}
