import { Film, Music, Users, Globe, Star, TrendingUp } from "lucide-react";

const items = [
  { icon: Film, title: "Upload & Distribute", desc: "Publish your films, series, podcasts, and music to a global audience. Full control over your catalogue." },
  { icon: TrendingUp, title: "Real-Time Analytics", desc: "Track views, engagement, revenue, and audience demographics. AI-powered recommendations grow your reach." },
  { icon: Music, title: "Sync Licensing", desc: "Musicians can license tracks directly to filmmakers on the platform. Transparent deals, instant placement." },
  { icon: Users, title: "Crew & Auditions", desc: "Post audition calls, manage crew lists, and connect with talent across South Africa and beyond." },
  { icon: Globe, title: "Student Films", desc: "Dedicated showcase for student filmmakers. The next generation of African filmmakers, featured prominently." },
  { icon: Star, title: "Equipment Marketplace", desc: "Find camera, lighting, sound, and post-production equipment from rental companies across the country." },
];

export function Features() {
  return (
    <section className="py-20 px-6 bg-slate-900/30 border-t border-slate-800/40">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3 text-white tracking-tight">
          Everything Creators Need
        </h2>
        <p className="text-slate-400 text-center mb-16 max-w-xl mx-auto">
          A complete ecosystem for independent filmmakers, musicians, and storytellers.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <div key={i} className="p-8 rounded-2xl border border-slate-700/40 bg-slate-800/20 hover:bg-slate-800/40 transition group">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-5 group-hover:bg-orange-500/20 transition">
                <item.icon className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-lg">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
