"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

export type DashboardNavItem = {
  href: string;
  label: string;
  highlight?: boolean;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type DashboardNavSection = {
  title?: string;
  items: DashboardNavItem[];
};

function defaultIsActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/funders") return pathname === "/funders";
  if (href === "/browse") return pathname === "/browse" || pathname.startsWith("/browse/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useOverlayNavMode(): boolean {
  const { deviceClass, orientation, breakpoint } = useAdaptiveUi();
  if (deviceClass === "mobile") return true;
  if (deviceClass === "tablet" && orientation === "portrait") return true;
  if (breakpoint === "xs" || breakpoint === "sm" || breakpoint === "md") return true;
  return false;
}

function NavLinks({
  sections,
  pathname,
  onNavigate,
}: {
  sections: DashboardNavSection[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="space-y-5 text-sm">
      {sections.map((section) => (
        <div key={section.title ?? section.items[0]?.href ?? "section"}>
          {section.title ? (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = defaultIsActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={[
                    "flex items-center gap-2 rounded-lg px-3 py-2 transition",
                    active
                      ? "border border-orange-500/25 bg-orange-500/[0.08] text-white shadow-[0_0_28px_-14px_rgba(249,115,22,0.55)]"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                    item.highlight ? "font-medium text-orange-400 hover:text-orange-300" : "",
                    item.className ?? "",
                  ].join(" ")}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DashboardSidebarShell({
  brandHref,
  brandLabel,
  headerEnd,
  navSections,
  sidebar,
  sidebarFooter,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
  mainClassName = "",
}: {
  brandHref: string;
  brandLabel: ReactNode;
  headerEnd?: ReactNode;
  navSections?: DashboardNavSection[];
  sidebar?: ReactNode | ((ctx: { closeSidebar: () => void; pathname: string }) => ReactNode);
  sidebarFooter?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  mainClassName?: string;
}) {
  const pathname = usePathname();
  const overlayMode = useOverlayNavMode();
  const { deviceClass } = useAdaptiveUi();
  const [sidebarOpen, setSidebarOpen] = useState(!overlayMode);

  useEffect(() => {
    setSidebarOpen(!overlayMode);
  }, [overlayMode]);

  useEffect(() => {
    if (overlayMode) setSidebarOpen(false);
  }, [pathname, overlayMode]);

  useEffect(() => {
    if (!overlayMode || !sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayMode, sidebarOpen]);

  const closeSidebar = () => {
    if (overlayMode) setSidebarOpen(false);
  };

  const sidebarBody =
    typeof sidebar === "function"
      ? sidebar({ closeSidebar, pathname })
      : sidebar ??
        (navSections ? <NavLinks sections={navSections} pathname={pathname} onNavigate={closeSidebar} /> : null);

  const paddedHeader = deviceClass === "mobile" ? "px-3 py-3" : "px-6 py-4 md:px-12";
  const paddedContent = deviceClass === "mobile" ? "px-3 py-4" : "px-4 py-6 md:px-8";
  const headerHeightClass = deviceClass === "mobile" ? "top-[3.75rem]" : "top-[4.25rem]";

  const showDockedSidebar = !overlayMode && sidebarOpen;

  return (
    <div className={`relative min-h-screen bg-background text-foreground ${className}`.trim()}>
      <header
        className={`sticky top-0 z-50 border-b border-white/8 bg-background/95 backdrop-blur-xl ${paddedHeader} ${headerClassName}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <Link
              href={brandHref}
              onClick={closeSidebar}
              className="min-w-0 truncate text-sm font-semibold text-white sm:text-base md:text-xl"
            >
              {brandLabel}
            </Link>
          </div>
          {headerEnd ? (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">{headerEnd}</div>
          ) : null}
        </div>
      </header>

      {overlayMode ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className={[
              `fixed inset-0 ${headerHeightClass} z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300`,
              sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          />
          <aside
            className={[
              `fixed bottom-0 left-0 ${headerHeightClass} z-[45] flex w-[min(18rem,88vw)] flex-col border-r border-white/10 bg-black/98 shadow-2xl backdrop-blur-md`,
              "transition-transform duration-300 ease-out",
              sidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
            ].join(" ")}
            aria-hidden={!sidebarOpen}
          >
            <div className="flex-1 overflow-y-auto px-3 py-4">{sidebarBody}</div>
            {sidebarFooter ? (
              <div className="shrink-0 border-t border-white/8 p-3">{sidebarFooter}</div>
            ) : null}
          </aside>
        </>
      ) : null}

      <div className={`relative mx-auto w-full max-w-7xl ${paddedContent} ${contentClassName}`}>
        <div className="flex w-full gap-4 md:gap-6">
          {showDockedSidebar ? (
            <aside className="hidden w-56 shrink-0 md:block xl:w-64">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">{sidebarBody}</div>
              {sidebarFooter ? <div className="mt-4">{sidebarFooter}</div> : null}
            </aside>
          ) : null}

          <main className={`min-w-0 w-full flex-1 ${mainClassName}`}>{children}</main>
        </div>
      </div>
    </div>
  );
}

export function DashboardSidebarNav({
  children,
  onNavigate,
}: {
  children: (ctx: { onNavigate: () => void; pathname: string }) => ReactNode;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  return <>{children({ onNavigate, pathname })}</>;
}
