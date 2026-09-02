"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CreatorPackageGate } from "@/components/creator/creator-package-gate";
import { CreatorPipelineRouteGate } from "@/components/creator/creator-pipeline-route-gate";
import { CreatorStudioActingLabel } from "@/components/creator/creator-studio-switcher";
import { CatalogueUploadProvider } from "@/components/creator/catalogue-upload-provider";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";
import { isCreatorPipelineToolPath } from "@/lib/project-tools";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

const operatingNavItems = [
  { href: "/creator/command-center", label: "Command Center" },
  { href: "/creator/dashboard", label: "My Projects" },
  { href: "/creator/network", label: "Network" },
  { href: "/creator/messages", label: "Messages" },
  { href: "/creator/account", label: "My Account" },
];

const monetizationNavItems = [
  { href: "/creator/wallet", label: "Wallet & payouts" },
  { href: "/creator/catalogue", label: "My catalogue", requiresCatalogue: true },
  { href: "/creator/upload", label: "Catalogue upload", requiresCatalogue: true },
];

function navLinkClass(active: boolean, extra = "") {
  return [
    "flex items-center px-3 py-2 rounded-lg text-sm transition",
    active ? "bg-white/[0.08] text-white shadow-panel" : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
    extra,
  ].join(" ");
}

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { deviceClass } = useAdaptiveUi();
  const role = session?.user?.role;
  const pipelineToolMode = isCreatorPipelineToolPath(pathname);

  const { data: licensePayload } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const suite = licensePayload?.suiteAccess as Record<string, boolean> | undefined;
  const allowPre = suite == null || suite.pipeline_pre === true;
  const allowProd = suite == null || suite.pipeline_prod === true;
  const allowPost = suite == null || suite.pipeline_post === true;
  const allowCatalogue = suite == null || suite.catalogue_upload === true;
  const showPipelineNav = licensePayload?.pipelineAccess !== false;
  const monetizationNavFiltered = useMemo(() => {
    return monetizationNavItems.filter((item) => {
      if (item.requiresCatalogue && !allowCatalogue) return false;
      // When upload-only, catalogue links live under the Distribution heading instead.
      if (item.requiresCatalogue && !showPipelineNav) return false;
      return true;
    });
  }, [allowCatalogue, showPipelineNav]);
  const { data: studioPayload } = useQuery({
    queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY],
    queryFn: () => fetch("/api/creator/studio-profiles").then((r) => r.json()),
    enabled: role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR",
  });
  const ownedCompanyCount = studioPayload?.companies?.length ?? 0;
  const showCompanyAdminNav = ownedCompanyCount > 0;
  const showAccountControlNav = ownedCompanyCount > 0;
  const preProductionNavActive =
    pathname.startsWith("/creator/pre-production") || pathname.startsWith("/creator/marketplace");
  const [preProductionOpen, setPreProductionOpen] = useState(preProductionNavActive);

  useEffect(() => {
    if (preProductionNavActive) setPreProductionOpen(true);
  }, [preProductionNavActive]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  if (pathname.startsWith("/creator/onboarding")) {
    return <>{children}</>;
  }

  return (
    <CatalogueUploadProvider>
    <DashboardSidebarShell
      className="text-slate-100 adaptive-tv-surface"
      sidebarAutoCollapse={isCreatorPipelineToolPath}
      contentClassName={pipelineToolMode ? "max-w-none px-2 py-2 md:px-3 md:py-3" : ""}
      brandHref="/creator/command-center"
      brandLabel="Creator"
      headerEnd={
        <>
          <CreatorStudioActingLabel />
          <NotificationBell />
          <button
            onClick={handleSignOut}
            className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </>
      }
      sidebar={({ closeSidebar, pathname }) => (
        <nav className="space-y-1">
          {showAccountControlNav ? (
            <div className="mb-2 space-y-1 border-b border-slate-800 pb-2">
              <p className="px-3 text-[11px] uppercase tracking-wide text-slate-500">Studio</p>
              <Link
                href="/creator/company/control"
                onClick={closeSidebar}
                className={navLinkClass(pathname.startsWith("/creator/company/control"))}
              >
                Account control
              </Link>
              {showCompanyAdminNav ? (
                <Link
                  href="/creator/company"
                  onClick={closeSidebar}
                  className={navLinkClass(
                    pathname.startsWith("/creator/company") && !pathname.startsWith("/creator/company/control")
                  )}
                >
                  Company admin
                </Link>
              ) : null}
            </div>
          ) : null}
          <p className="px-3 pb-1 pt-1 text-[11px] uppercase tracking-wide text-slate-500">Operating</p>
          {operatingNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={closeSidebar} className={navLinkClass(isActive)}>
                {item.label}
              </Link>
            );
          })}

          <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
            <p className="px-3 text-[11px] uppercase tracking-wide text-slate-500">Monetization</p>
            {monetizationNavFiltered.map((item) => {
              const isActive =
                item.href.includes("#")
                  ? pathname.startsWith("/creator/command-center")
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} onClick={closeSidebar} className={navLinkClass(isActive)}>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
            <Link
              href="/creator/originals/submit"
              onClick={closeSidebar}
              className={navLinkClass(
                pathname.startsWith("/creator/originals"),
                "font-medium " +
                  (pathname.startsWith("/creator/originals")
                    ? "bg-orange-500/15 text-orange-300 shadow-panel"
                    : "text-orange-400 hover:bg-orange-500/10 hover:text-orange-300")
              )}
            >
              Originals
            </Link>
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
            <p className="px-3 text-[11px] uppercase tracking-wide text-slate-500">
              {showPipelineNav ? "Pipeline" : "Distribution"}
            </p>
            {showPipelineNav && (allowPre || allowProd || allowPost) ? (
              <>
                {allowPre ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Link
                        href="/creator/pre-production"
                        onClick={() => {
                          setPreProductionOpen(true);
                          closeSidebar();
                        }}
                        className={[
                          "flex flex-1 items-center px-3 py-2 rounded-lg text-sm transition",
                          preProductionNavActive
                            ? "bg-white/[0.08] text-white shadow-panel"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        ].join(" ")}
                      >
                        Pre-Production
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPreProductionOpen((open) => !open)}
                        aria-expanded={preProductionOpen}
                        aria-label={preProductionOpen ? "Collapse pre-production menu" : "Expand pre-production menu"}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        {preProductionOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {preProductionOpen ? (
                      <Link
                        href="/creator/marketplace"
                        onClick={closeSidebar}
                        className={[
                          "ml-4 flex items-center border-l border-white/10 py-2 pl-4 pr-3 text-sm transition",
                          pathname.startsWith("/creator/marketplace")
                            ? "border-orange-400/40 text-orange-200"
                            : "text-slate-400 hover:text-white",
                        ].join(" ")}
                      >
                        Marketplace
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {allowProd ? (
                  <Link
                    href="/creator/production"
                    onClick={closeSidebar}
                    className={navLinkClass(pathname.startsWith("/creator/production"))}
                  >
                    Production
                  </Link>
                ) : null}
                {allowPost ? (
                  <Link
                    href="/creator/post-production"
                    onClick={closeSidebar}
                    className={navLinkClass(pathname.startsWith("/creator/post-production"))}
                  >
                    Post-Production
                  </Link>
                ) : null}
              </>
            ) : null}
            {!showPipelineNav && allowCatalogue ? (
              <>
                <Link
                  href="/creator/catalogue"
                  onClick={closeSidebar}
                  className={navLinkClass(pathname.startsWith("/creator/catalogue"))}
                >
                  My catalogue
                </Link>
                <Link
                  href="/creator/upload"
                  onClick={closeSidebar}
                  className={navLinkClass(pathname.startsWith("/creator/upload"))}
                >
                  Catalogue upload
                </Link>
                <p className="px-3 pt-1 text-[11px] leading-relaxed text-slate-500">
                  Upload-only plan — pipeline tools unlock with Creator Pipeline.
                </p>
              </>
            ) : null}
            {showPipelineNav && !allowPre && !allowProd && !allowPost && allowCatalogue ? (
              <>
                <Link
                  href="/creator/catalogue"
                  onClick={closeSidebar}
                  className={navLinkClass(pathname.startsWith("/creator/catalogue"))}
                >
                  My catalogue
                </Link>
                <Link
                  href="/creator/upload"
                  onClick={closeSidebar}
                  className={navLinkClass(pathname.startsWith("/creator/upload"))}
                >
                  Catalogue upload
                </Link>
              </>
            ) : null}
          </div>
        </nav>
      )}
      sidebarFooter={
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      }
      mainClassName={deviceClass === "tv" ? "text-lg" : ""}
    >
      <div data-storytime-creator>
        <CreatorPackageGate>
          <CreatorPipelineRouteGate>{children}</CreatorPipelineRouteGate>
        </CreatorPackageGate>
      </div>
    </DashboardSidebarShell>
    </CatalogueUploadProvider>
  );
}
