import { Shield } from "lucide-react";

export function Security() {
  return (
    <section className="py-20 px-6 border-t border-slate-800/40">
      <div className="max-w-4xl mx-auto text-center">
        <Shield className="w-12 h-12 text-orange-500 mx-auto mb-6" />
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white tracking-tight">Enterprise-Grade Security</h2>
        <p className="text-slate-400 mb-10 max-w-xl mx-auto">
          Your content and data are protected with industry-leading security measures.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["AES-256 Encryption", "DRM Protection", "SOC 2 Compliant", "2FA Authentication"].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40">
              <p className="text-sm font-medium text-slate-300">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
