import type { StakeholderPortalKey } from "@/lib/stakeholder-ecosystem/types";
import {
  StakeholderActivityPage,
  StakeholderCalendarPage,
  StakeholderTasksPage,
} from "@/components/ecosystem/stakeholder-workspace-pages";

type Section = "tasks" | "calendar" | "activity";

export function createStakeholderWorkspacePage(portal: StakeholderPortalKey, section: Section) {
  const prefix = `/${portal}`;
  switch (section) {
    case "tasks":
      return function Page() {
        return <StakeholderTasksPage portalPrefix={prefix} />;
      };
    case "calendar":
      return function Page() {
        return <StakeholderCalendarPage portalPrefix={prefix} />;
      };
    case "activity":
      return function Page() {
        return <StakeholderActivityPage portalPrefix={prefix} />;
      };
  }
}
