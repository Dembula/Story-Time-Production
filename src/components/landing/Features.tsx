import {
  BarChart3,
  Clapperboard,
  FilePenLine,
  LockKeyhole,
  Map,
  MessagesSquare,
  Music,
  Network,
  ShieldCheck,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

const items = [
  { icon: FilePenLine, title: "Script Writing Space", desc: "Give raw ideas a place to become real, with room to shape voice, structure, and intention before the rest of the world ever sees them." },
  { icon: Workflow, title: "Guided Creative Flow", desc: "Move from concept to completion inside a system that keeps the process coherent, so the work never gets lost between disconnected tools." },
  { icon: Upload, title: "Release to the World", desc: "Bring stories to audiences without surrendering control, using creator-led publishing that keeps distribution in your hands." },
  { icon: Map, title: "Sustainable Creator Pathways", desc: "Build a practice that can last, supported by a model designed around clarity, continuity, and respect for creative contribution." },
  { icon: BarChart3, title: "Audience Understanding", desc: "See how your work is being received so you can respond with intention, deepen your voice, and shape what comes next." },
  { icon: Sparkles, title: "MODOC Intelligence", desc: "Use AI as a creative companion for development, structure, discovery, and reflection rather than a replacement for your point of view." },
  { icon: Network, title: "Identity & Presence", desc: "Build a professional creative identity that helps your work be seen, remembered, and connected to a wider cultural conversation." },
  { icon: MessagesSquare, title: "Collaboration in Context", desc: "Work with people inside the same ecosystem, where communication stays close to the project and relationships can deepen naturally." },
  { icon: Music, title: "Sound, Rights & Discovery", desc: "Find music, connect with composers, and shape the sonic identity of a project without leaving the world you are building." },
  { icon: Clapperboard, title: "Production Access", desc: "Reach the people and services a story needs, from equipment to casting to crew, inside a network designed to reduce friction." },
  { icon: LockKeyhole, title: "Ownership & Protection", desc: "Keep control of the work through secure handling, rights-aware systems, and structures that respect authorship at every stage." },
  { icon: ShieldCheck, title: "Trust by Design", desc: "Create in an environment shaped by care, accountability, and safeguards that protect both the creator and the audience experience." },
];

export function Features() {
  return (
    <section id="features" className="border-t border-white/8 bg-white/[0.02] px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <LandingReveal className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Built for Every Stage of the Creator Journey
          </h2>
          <p className="mx-auto mb-16 max-w-3xl text-center text-lg leading-8 text-slate-300/80">
            Story Time brings the full creative lifecycle into one environment so creators can stay close to the work, close to their audience, and close to their own direction.
          </p>
        </LandingReveal>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => (
            <LandingReveal key={item.title} delay={i * 0.04}>
              <div className="storytime-panel group h-full rounded-[1.6rem] p-8 hover:-translate-y-1 hover:bg-white/[0.04]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/16 bg-orange-500/10 group-hover:border-orange-300/28 group-hover:bg-orange-500/18">
                  <item.icon className="h-6 w-6 text-orange-300" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-7 text-slate-300/78">{item.desc}</p>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
