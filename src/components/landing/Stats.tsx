import { Layers3, Compass, Globe2, BriefcaseBusiness } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

const ecosystemItems = [
  {
    stat: "12+",
    label: "Connected creator systems",
    desc: "Writing, workflow, release, discovery, collaboration, and production support operate as one connected environment.",
    icon: Layers3,
  },
  {
    stat: "Clear",
    label: "Value moves transparently",
    desc: "Attention, contribution, and audience connection circulate through the ecosystem in a way creators can understand and trust.",
    icon: Compass,
  },
  {
    stat: "1",
    label: "Unified launch destination",
    desc: "Build, release, find collaborators, secure music, and reach audiences from a single creative home.",
    icon: Globe2,
  },
  {
    stat: "Career",
    label: "Built for long-term opportunity",
    desc: "Story Time is infrastructure for independent creative lives, not just another place to publish content.",
    icon: BriefcaseBusiness,
  },
];

export function Stats() {
  return (
    <section className="border-t border-white/8 px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <LandingReveal className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            More Than a Platform. An Operating System for Storytelling.
          </h2>
          <p className="mx-auto mb-16 max-w-3xl text-center text-lg leading-8 text-slate-300/80">
            Story Time gives creators the infrastructure to develop work, bring people together, release stories widely, and build a future around creative ownership instead of dependence.
          </p>
        </LandingReveal>
        <div className="mb-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {ecosystemItems.map((item, i) => (
            <LandingReveal key={item.label} delay={i * 0.06}>
              <div className="storytime-panel group rounded-[1.45rem] p-6 hover:-translate-y-1 hover:border-orange-400/20 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/16 bg-orange-500/10">
                  <item.icon className="h-6 w-6 text-orange-300" />
                </div>
                <div className="mb-2 text-3xl font-bold text-orange-300">{item.stat}</div>
                <h3 className="mb-2 font-semibold text-white">{item.label}</h3>
                <p className="text-sm leading-relaxed text-slate-300/76">{item.desc}</p>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
