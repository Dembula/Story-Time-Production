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
                      ? "bg-white/[0.08] text-white shadow-panel"
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
  /** Simple layouts: flat nav sections (one section without title is fine). */
  navSections?: DashboardNavSection[];
  /** Complex layouts: custom sidebar nav (creator, etc.). */
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

  return (
    <div className={`relative min-h-screen bg-background text-foreground ${className}`.trim()}>
      <header
        className={`relative z-30 border-b border-white/8 bg-white/[0.03] backdrop-blur-xl ${paddedHeader} ${headerClassName}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <Link href={brandHref} className="truncate text-xl font-semibold text-white" onClick={closeSidebar}>
              {brandLabel}
            </Link>
          </div>
          {headerEnd ? <div className="flex shrink-0 items-center gap-2 sm:gap-3">{headerEnd}</div> : null}
        </div>
      </header>

      {overlayMode && sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className={`relative mx-auto max-w-7xl ${paddedContent} ${contentClassName}`}>
        <div className="flex gap-0 md:gap-6">
          {sidebarOpen ? (
            overlayMode ? (
              <aside
                className="fixed bottom-0 left-0 top-[4.25rem] z-50 flex w-[min(18rem,88vw)] flex-col border-r border-white/12 bg-[#080c16] shadow-2xl ring-1 ring-black/40"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                <div className="flex-1 overflow-y-auto px-3 py-4">{sidebarBody}</div>
                {sidebarFooter ? (
                  <div className="shrink-0 border-t border-white/8 p-3">{sidebarFooter}</div>
                ) : null}
              </aside>
            ) : (
              <aside className="w-56 shrink-0 xl:w-64">
                <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">{sidebarBody}</div>
                {sidebarFooter ? <div className="mt-4">{sidebarFooter}</div> : null}
              </aside>
            )
          ) : null}

          <main className={`min-w-0 flex-1 ${mainClassName}`}>{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Wrap custom nav links so they close the overlay drawer on tap. */
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
