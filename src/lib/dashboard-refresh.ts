/** Admin dashboards poll live platform stats every 5 minutes. */
export const ADMIN_DASHBOARD_REFETCH_MS = 5 * 60 * 1000;

/** Creator, funder, and marketplace payee dashboards refresh weekly. */
export const PAYEE_DASHBOARD_REFETCH_MS = 7 * 24 * 60 * 60 * 1000;

/** Command Center production calendar — keeps shoot days and tasks fresh. */
export const COMMAND_CENTER_CALENDAR_REFETCH_MS = 30 * 1000;
