import type { DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";

/** Admin sidebar — grouped by operational sector. */
export const adminNavSections: DashboardNavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/review", label: "Review hub" },
      { href: "/admin/script-reviews", label: "Executive script reviews", highlight: true },
      { href: "/admin/projects", label: "Creator projects" },
    ],
  },
  {
    title: "Content & catalogue",
    items: [
      { href: "/admin/content", label: "Content" },
      { href: "/admin/encode-health", label: "Encode health" },
      { href: "/admin/credit-people", label: "Credit identities" },
      { href: "/admin/originals", label: "Story Time Originals", highlight: true },
      { href: "/admin/music", label: "Music" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/crew", label: "Crew" },
      { href: "/admin/cast", label: "Cast" },
      { href: "/admin/locations", label: "Locations" },
      { href: "/admin/marketplace-vendors", label: "Equipment & catering" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/promo-codes", label: "Promo codes" },
      { href: "/admin/funders", label: "Funders" },
      { href: "/admin/funding-programs", label: "Funding programs" },
      { href: "/admin/payout-verification", label: "Payout KYC" },
    ],
  },
  {
    title: "People & access",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/creators", label: "Creators" },
      { href: "/admin/requests", label: "Access requests" },
      { href: "/admin/activity", label: "Activity log" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/ai", label: "AI & VA" },
      { href: "/admin/competition", label: "Competition" },
      { href: "/browse", label: "View public site" },
    ],
  },
];
