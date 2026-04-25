import { LandingReveal } from "@/components/landing/LandingReveal";

const networkNodes = [
  { label: "Creators", x: "10%", y: "18%" },
  { label: "Audience", x: "58%", y: "10%" },
  { label: "Music", x: "78%", y: "38%" },
  { label: "Cast", x: "18%", y: "58%" },
  { label: "Crew", x: "46%", y: "56%" },
  { label: "Locations", x: "74%", y: "72%" },
];

const flowSteps = [
  { title: "Audiences bring attention", text: "Viewership enters the ecosystem as energy, presence, and recognition around the work that moves people." },
  { title: "Contribution is understood clearly", text: "Engagement, participation, and cultural response are made visible so value is not hidden behind gatekeepers or black boxes." },
  { title: "The ecosystem strengthens creators", text: "What circulates through Story Time returns as sustainability, visibility, and the ability to keep building on your own terms." },
];

export function Vision() {
  return (
    <section className="border-t border-white/8 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <LandingReveal className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white md:text-4xl">
            A Network That Expands Creative Possibility.
          </h2>
          <p className="mb-10 sm:mb-14 text-center text-base sm:text-lg leading-7 sm:leading-8 text-slate-300/80">
            Story Time connects creators to audiences, collaborators, and shared momentum in one system where visibility, relationships, and contribution reinforce one another over time.
          </p>
        </LandingReveal>
        <div className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr]">
          <LandingReveal>
            <div className="storytime-section relative overflow-hidden p-5 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_22%,rgba(255,171,63,0.18),transparent_28%)]" />
              <div className="relative">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">Creator network</p>
                <h3 className="mb-3 font-display text-2xl font-semibold text-white">
                  Creators do not grow alone.
                </h3>
                <p className="mb-8 max-w-2xl text-sm leading-7 text-slate-300/78">
                  On Story Time, discovery, collaboration, and production infrastructure are connected. Writers, filmmakers, music creators, talent, crews, and service providers become part of a living creative field where more visibility leads to more connection, and more connection leads to more possibility.
                </p>
                <div className="relative h-[250px] sm:h-[320px] overflow-hidden rounded-[1.75rem] border border-white/8 bg-black/18">
                  {[
                    { from: [16, 22], to: [60, 16] },
                    { from: [16, 22], to: [24, 60] },
                    { from: [24, 60], to: [48, 58] },
                    { from: [48, 58], to: [78, 40] },
                    { from: [60, 16], to: [78, 40] },
                    { from: [48, 58], to: [76, 74] },
                  ].map((line, i) => (
                    <div
                      key={i}
                      className="absolute h-px origin-left bg-gradient-to-r from-orange-300/55 via-orange-200/25 to-transparent"
                      style={{
                        left: `${line.from[0]}%`,
                        top: `${line.from[1]}%`,
                        width: `${Math.hypot(line.to[0] - line.from[0], line.to[1] - line.from[1]) * 2.9}%`,
                        transform: `rotate(${Math.atan2(line.to[1] - line.from[1], line.to[0] - line.from[0])}rad)`,
                      }}
                    />
                  ))}
                  {networkNodes.map((node, i) => (
                    <div
                      key={node.label}
                      className="absolute"
                      style={{ left: node.x, top: node.y }}
                    >
                      <div className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                        <div className="h-4 w-4 rounded-full bg-orange-300 shadow-[0_0_26px_rgba(255,179,71,0.72)]" />
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-sm">
                          {node.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </LandingReveal>

          <LandingReveal delay={0.08}>
            <div className="storytime-section p-5 sm:p-8">
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">Value in motion</p>
              <h3 className="mb-3 font-display text-2xl font-semibold text-white">
                How value flows through Story Time
              </h3>
              <p className="mb-8 text-sm leading-7 text-slate-300/78">
                Story Time is designed as a fair, legible system where audience attention, creative contribution, and platform participation strengthen one another instead of being extracted by intermediaries.
              </p>
              <div className="space-y-4">
                {flowSteps.map((step, index) => (
                  <div key={step.title} className="storytime-panel rounded-2xl p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 font-semibold text-orange-300">
                        {index + 1}
                      </div>
                      <p className="font-semibold text-white">{step.title}</p>
                    </div>
                    <p className="pl-12 text-sm leading-6 text-slate-300/76">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}
