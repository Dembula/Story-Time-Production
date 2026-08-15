export function Security() {
  const items = [
    "Authenticated accounts",
    "Role-based access",
    "Age-aware profiles",
    "Admin review",
  ];

  return (
    <section className="border-t border-white/8 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">Built with care</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-white sm:text-2xl">
          Secure by default
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-xs font-medium text-slate-300 sm:text-sm"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
