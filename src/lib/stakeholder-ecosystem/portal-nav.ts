import type { DashboardNavItem, DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";
import type { StakeholderPortalKey } from "./types";

const WORKSPACE_NAV: DashboardNavItem[] = [
  { href: "", label: "Action centre", className: "hidden" },
];

export function dashboardHomeHref(portal: StakeholderPortalKey): string {
  return portal === "funders" ? "/funders" : `/${portal}/dashboard`;
}

export function workspaceNavItems(portal: StakeholderPortalKey): DashboardNavItem[] {
  const base = `/${portal}`;
  return [
    { href: `${base}/tasks`, label: "Action centre" },
    { href: `${base}/calendar`, label: "Calendar" },
    { href: `${base}/activity`, label: "Activity feed" },
  ];
}

/** Merge ecosystem workspace nav with existing portal nav — additive upgrade. */
export function mergeStakeholderNavSections(
  portal: StakeholderPortalKey,
  businessItems: DashboardNavItem[],
): DashboardNavSection[] {
  void WORKSPACE_NAV;
  const home = dashboardHomeHref(portal);
  return [
    {
      title: "Workspace",
      items: [{ href: home, label: "Home" }, ...workspaceNavItems(portal)],
    },
    {
      title: "Operations",
      items: businessItems.filter((i) => !i.href.endsWith("/dashboard")),
    },
  ];
}

export function portalFromRole(role: string): StakeholderPortalKey | null {
  switch (role) {
    case "CASTING_AGENCY":
      return "casting-agency";
    case "CREW_TEAM":
      return "crew-team";
    case "LOCATION_OWNER":
      return "location-owner";
    case "EQUIPMENT_COMPANY":
      return "equipment-company";
    case "CATERING_COMPANY":
      return "catering-company";
    case "FUNDER":
      return "funders";
    default:
      return null;
  }
}
