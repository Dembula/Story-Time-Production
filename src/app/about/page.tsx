import Link from "next/link";

const placeholders = [
  {
    title: "Our story",
    text: "This section is ready for your platform narrative, founding vision, and why Story Time exists.",
  },
  {
    title: "The team",
    text: "Add your founders, leadership, creative operators, advisors, and the people building Story Time.",
  },
  {
    title: "Company information",
    text: "Use this space for registered business details, operating entity information, and public-facing trust signals.",
  },
  {
    title: "Press and partnerships",
    text: "You can add media enquiries, collaboration details, investor notes, or strategic partnership information here.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,170,82,0.14),transparent_28%),linear-gradient(180deg,#05070d_0%,#090d18_40%,#0b1020_100%)]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />

      <header className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-semibold tracking-[0.14em] text-slate-200 transition hover:text-white">
            STORY <span className="storytime-brand-text">TIME</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/legal/terms" className="text-slate-400 transition hover:text-slate-200">
              Legal
            </Link>
            <Link href="/" className="text-slate-500 transition hover:text-slate-300">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-6 shadow-panel backdrop-blur-xl md:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
              About Story Time
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
              A space reserved for your team, story, and public trust layer.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              This page is intentionally left open for the information you want to add
              later, including your team, company background, public mission, and
              operational details.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {placeholders.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/8 bg-slate-950/55 p-6 shadow-panel backdrop-blur-xl"
            >
              <h2 className="mb-3 text-xl font-semibold text-white">{item.title}</h2>
              <p className="text-sm leading-7 text-slate-300">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-7 text-slate-400">
          Add founder bios, company registration details, contact information, office
          location, media resources, support channels, or any other trust signals you
          want visible to viewers, creators, partners, and payment reviewers.
        </section>
      </main>
    </div>
  );
}
