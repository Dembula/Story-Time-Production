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
    <section className="border-t border-white/8 px-3 py-10 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <LandingReveal className="mx-auto w-full text-center">
          <h2 className="mb-3 sm:mb-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white md:text-4xl">
            More Than a Platform. An Operating System for Storytelling.
          </h2>
          <p className="mx-auto mb-8 w-full text-center text-base leading-7 text-slate-300/80 sm:mb-16 sm:max-w-3xl sm:text-lg sm:leading-8">
            Story Time gives creators the infrastructure to develop work, bring people together, release stories widely, and build a future around creative ownership instead of dependence.
          </p>
        </LandingReveal>
        <div className="mb-8 grid w-full gap-3 sm:mb-16 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
          {ecosystemItems.map((item, i) => (
            <LandingReveal key={item.label} delay={i * 0.06}>
              <div className="storytime-panel group rounded-2xl p-4 sm:rounded-[1.45rem] sm:p-6 hover:-translate-y-1 hover:border-orange-400/20 hover:bg-white/[0.04]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/16 bg-orange-500/10 sm:mb-5 sm:h-12 sm:w-12 sm:rounded-2xl">
                  <item.icon className="h-5 w-5 text-orange-300 sm:h-6 sm:w-6" />
                </div>
                <div className="mb-2 text-2xl font-bold text-orange-300 sm:text-3xl">{item.stat}</div>
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
