export type TourStatus = "COMPLETED" | "DISMISSED";

export type TourRole =
  | "CONTENT_CREATOR"
  | "MUSIC_CREATOR"
  | "FUNDER"
  | "EQUIPMENT_COMPANY"
  | "LOCATION_OWNER"
  | "CREW_TEAM"
  | "CASTING_AGENCY"
  | "CATERING_COMPANY"
  | "ADMIN";

export type TourStep = {
  /** Stable step id for analytics / debugging */
  id: string;
  title: string;
  body: string;
  /**
   * CSS selector for the highlighted element.
   * Prefer `[data-tour="…"]` anchors.
   */
  target: string;
  /** Optional: only run this step when the element exists after wait. */
  optional?: boolean;
  /** Placement hint for the tooltip relative to the target. */
  placement?: "auto" | "top" | "bottom" | "left" | "right";
};

export type TourDefinition = {
  id: string;
  /** Bumped when copy/steps change enough that returning users should see it again. */
  version: number;
  title: string;
  /** Roles that may see this tour. Empty = any authenticated role that matches route. */
  roles: TourRole[];
  /**
   * Match current pathname. First matching eligible unfinished tour wins.
   * Use a function for dynamic project tool paths.
   */
  match: (pathname: string) => boolean;
  /** Prefer higher when multiple tours match (e.g. tool-specific > generic). */
  priority?: number;
  steps: TourStep[];
  /** Delay after route change before looking for targets (ms). */
  startDelayMs?: number;
};

export type TourProgressRecord = {
  tourId: string;
  status: TourStatus;
  tourVersion: number;
  updatedAt: string;
};
