import { Shield } from "lucide-react";

export function Security() {
  const items = [
    "Authenticated accounts",
    "Role-based access",
    "Age-aware viewing controls",
    "Admin review workflow",
  ];

  return (
    <section className="border-t border-white/8 py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <Shield className="mx-auto mb-6 h-12 w-12 text-orange-300" />
        <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">Protection Without Compromise</h2>
        <p className="mx-auto mb-10 max-w-xl text-slate-300/80">
          Story Time is structured to protect access, audience trust, and the integrity
          of what gets published. The platform uses controlled account access,
          moderation workflows, and age-aware viewing rules to keep the experience
          orderly and credible.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <div key={i} className="storytime-panel rounded-2xl p-4 hover:-translate-y-0.5">
              <p className="text-sm font-medium text-slate-200">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
