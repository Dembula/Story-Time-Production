import { SettingsClient } from "./settings-client";

export default function BrowseSettingsPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold text-white mb-2">Settings</h1>
        <p className="text-slate-400 mb-8">Manage account, profiles, package, and payment methods.</p>
        <SettingsClient />
      </div>
    </div>
  );
}
