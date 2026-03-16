export function Vision() {
  const steps = [
    { step: "01", title: "Creator-First in South Africa", desc: "The leading platform for South African independent creators" },
    { step: "02", title: "Continental Expansion", desc: "Scaling across Africa to amplify Pan-African voices" },
    { step: "03", title: "World Stage", desc: "Taking African stories to audiences everywhere" },
  ];
  return (
    <section className="py-20 px-6 border-t border-slate-800/40">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3 text-white tracking-tight">Our Vision</h2>
        <p className="text-slate-400 text-center mb-14">From South Africa to the world</p>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <div key={i} className="p-8 rounded-2xl border border-slate-700/40 bg-slate-800/20 text-center relative overflow-hidden group hover:border-orange-500/20 transition">
              <div className="absolute top-3 right-4 text-6xl font-black text-slate-700/20 group-hover:text-orange-500/10 transition">{item.step}</div>
              <div className="text-2xl font-bold text-orange-500 mb-4">{item.step}</div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
