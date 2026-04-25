"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CreatorPipelineRouteGate } from "@/components/creator/creator-pipeline-route-gate";
import { CreatorStudioActingLabel } from "@/components/creator/creator-studio-switcher";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

const primaryNavItems = [
  { href: "/creator/command-center", label: "Command Center" },
  { href: "/creator/dashboard", label: "My Projects" },
  { href: "/creator/account", label: "My Account" },
  { href: "/creator/network", label: "Network" },
  { href: "/creator/messages", label: "Messages" },
  { href: "/creator/originals/submit", label: "Originals", highlight: true },
];

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { deviceClass, orientation } = useAdaptiveUi();
  const role = session?.user?.role;
  const [sidebarOpen, setSidebarOpen] = useState(deviceClass !== "mobile");
  const { data: licensePayload } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const suite = licensePayload?.suiteAccess as Record<string, boolean> | undefined;
  const allowPre = suite == null || suite.pipeline_pre === true;
  const allowProd = suite == null || suite.pipeline_prod === true;
  const allowPost = suite == null || suite.pipeline_post === true;
  const allowCatalogue = suite == null || suite.catalogue_upload === true;
  const primaryNavFiltered = useMemo(() => {
    if (!allowCatalogue) {
      return primaryNavItems.filter((item) => !item.href.startsWith("/creator/originals"));
    }
    return primaryNavItems;
  }, [allowCatalogue]);
  const { data: studioPayload } = useQuery({
    queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY],
    queryFn: () => fetch("/api/creator/studio-profiles").then((r) => r.json()),
    enabled: role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR",
  });
  const showCompanyAdminNav = Boolean(studioPayload?.companies?.length);
  const showAccountControlNav = role === "CONTENT_CREATOR" || role === "ADMIN";
  // While loading, show pipeline links to avoid a flash of hidden nav for full-pipeline creators.
  const showPipelineNav = licensePayload?.pipelineAccess !== false;

  useEffect(() => {
    if (deviceClass === "mobile") {
      setSidebarOpen(false);
      return;
    }
    if (deviceClass === "tablet" && orientation === "portrait") {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(true);
  }, [deviceClass, orientation]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 adaptive-tv-surface">
      <div className={`border-b border-white/8 bg-white/[0.03] backdrop-blur-xl ${deviceClass === "mobile" ? "px-3 py-3" : "px-6 py-4 md:px-12"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="adaptive-interactive inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
              aria-label={sidebarOpen ? "Hide menu" : "Show menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <Link href="/creator/command-center" className="text-xl font-semibold text-white">
              <span className="storytime-brand-text">STORY TIME</span> Creator
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <CreatorStudioActingLabel />
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto ${deviceClass === "mobile" ? "px-3 py-4 pb-20" : "px-4 md:px-8 py-6"} flex gap-4 md:gap-6`}>
        {sidebarOpen && (
          <aside className={`${deviceClass === "tablet" ? "w-64" : "w-56"} shrink-0`}>
            <nav className="space-y-1">
              {showAccountControlNav ? (
                <div className="mb-2 space-y-1 border-b border-slate-800 pb-2">
                  <p className="px-3 text-[11px] uppercase tracking-wide text-slate-500">Studio</p>
                  <Link
                    href="/creator/company/control"
                    className={[
                      "flex items-center px-3 py-2 rounded-lg text-sm transition",
                      pathname.startsWith("/creator/company/control")
                        ? "bg-white/[0.08] text-white shadow-panel"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                    ].join(" ")}
                  >
                    Account control
                  </Link>
                  {showCompanyAdminNav ? (
                    <Link
                      href="/creator/company"
                      className={[
                        "flex items-center px-3 py-2 rounded-lg text-sm transition",
                        pathname.startsWith("/creator/company") && !pathname.startsWith("/creator/company/control")
                          ? "bg-white/[0.08] text-white shadow-panel"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                      ].join(" ")}
                    >
                      Company admin
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {primaryNavFiltered.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center px-3 py-2 rounded-lg text-sm transition",
                      isActive
                        ? "bg-white/[0.08] text-white shadow-panel"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                      item.highlight ? "font-medium text-orange-400 hover:text-orange-300" : "",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
                <p className="px-3 text-[11px] uppercase tracking-wide text-slate-500">
                  {showPipelineNav ? "Pipeline" : "Distribution"}
                </p>
                {showPipelineNav && (allowPre || allowProd || allowPost) ? (
                  <>
                    {allowPre ? (
                      <Link
                        href="/creator/pre-production"
                        className={[
                          "flex items-center px-3 py-2 rounded-lg text-sm transition",
                          pathname.startsWith("/creator/pre-production")
                            ? "bg-white/[0.08] text-white shadow-panel"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        ].join(" ")}
                      >
                        Pre-Production
                      </Link>
                    ) : null}
                    {allowProd ? (
                      <Link
                        href="/creator/production"
                        className={[
                          "flex items-center px-3 py-2 rounded-lg text-sm transition",
                          pathname.startsWith("/creator/production")
                            ? "bg-white/[0.08] text-white shadow-panel"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        ].join(" ")}
                      >
                        Production
                      </Link>
                    ) : null}
                    {allowPost ? (
                      <Link
                        href="/creator/post-production"
                        className={[
                          "flex items-center px-3 py-2 rounded-lg text-sm transition",
                          pathname.startsWith("/creator/post-production")
                            ? "bg-white/[0.08] text-white shadow-panel"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        ].join(" ")}
                      >
                        Post-Production
                      </Link>
                    ) : null}
                  </>
                ) : null}
                {allowCatalogue ? (
                  <Link
                    href="/creator/upload"
                    className={[
                      "flex items-center px-3 py-2 rounded-lg text-sm transition",
                      pathname === "/creator/upload"
                        ? "bg-white/[0.08] text-white shadow-panel"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                    ].join(" ")}
                  >
                    Catalogue upload
                  </Link>
                ) : null}
              </div>

              <button
                onClick={handleSignOut}
                className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-900/70 transition w-full text-left md:hidden"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </nav>
          </aside>
        )}

        <main className={`flex-1 min-w-0 ${deviceClass === "tv" ? "text-lg" : ""}`}>
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              <PanelLeftOpen className="w-3 h-3" />
              Show menu
            </button>
          )}
          <CreatorPipelineRouteGate>{children}</CreatorPipelineRouteGate>
        </main>
      </div>
      {deviceClass === "mobile" && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#080c16]/95 px-2 py-2 backdrop-blur-xl">
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
            <Link href="/creator/command-center" className="adaptive-interactive rounded-lg px-2 py-2 text-center text-xs text-slate-200 hover:bg-white/[0.06]">Command</Link>
            <Link href="/creator/dashboard" className="adaptive-interactive rounded-lg px-2 py-2 text-center text-xs text-slate-200 hover:bg-white/[0.06]">Projects</Link>
            <Link href="/creator/network" className="adaptive-interactive rounded-lg px-2 py-2 text-center text-xs text-slate-200 hover:bg-white/[0.06]">Network</Link>
            <Link href="/creator/account" className="adaptive-interactive rounded-lg px-2 py-2 text-center text-xs text-slate-200 hover:bg-white/[0.06]">Account</Link>
          </div>
        </nav>
      )}
    </div>
  );
}
