export function Stats() {
  return (
    <section className="py-20 px-6 border-t border-slate-800/60">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3 text-white tracking-tight">
          Built for the Future of African Storytelling
        </h2>
        <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
          South Africa&apos;s film industry contributes billions to the economy, yet local films hold less than 4% of the domestic market. We&apos;re changing that.
        </p>
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          {[
            { stat: "4%", label: "Local Market Share", desc: "Domestic films hold under 4% market share. We're building pathways for creators." },
            { stat: "R7.18B", label: "Industry Value", desc: "Film industry contribution to the economy. Creators deserve their fair share." },
            { stat: "31K+", label: "Industry Jobs", desc: "Employment across the sector. We're creating more opportunities." },
            { stat: "100%", label: "Creator-Owned", desc: "Your content, your data, your revenue. No hidden algorithms." },
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/40 hover:border-orange-500/30 transition group">
              <div className="text-3xl font-bold text-orange-500 mb-2 group-hover:text-orange-400 transition">{item.stat}</div>
              <h3 className="font-semibold text-white mb-2">{item.label}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
