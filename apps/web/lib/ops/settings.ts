/** The weekly cut-off and lead time ops runs on. Stored in `ops_settings`; one row. */
export interface OpsSettings {
  /** 0 is Sunday, as `Date#getUTCDay`. */
  readonly cutoffWeekday: number;
  /** Minutes after midnight UTC. */
  readonly cutoffMinutes: number;
  /** Days from the cut-off to the day the factory promises. Null is "not set": nobody has agreed one. */
  readonly leadTimeDays: number | null;
  /** Says where the settings came from. */
  readonly label: string;
}

export const DEFAULT_SETTINGS_LABEL = "Knitwright default, not agreed with a factory";

/** Friday 17:00 UTC, no lead time. A placeholder to run on, never a measurement. Owner question O1 and O2. */
export const DEFAULT_OPS_SETTINGS: OpsSettings = {
  cutoffWeekday: 5,
  cutoffMinutes: 17 * 60,
  leadTimeDays: null,
  label: DEFAULT_SETTINGS_LABEL,
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** "Friday 17:00 UTC". */
export const describeCutoff = (s: OpsSettings): string => {
  const hh = String(Math.floor(s.cutoffMinutes / 60)).padStart(2, "0");
  const mm = String(s.cutoffMinutes % 60).padStart(2, "0");
  return `${WEEKDAYS[s.cutoffWeekday]} ${hh}:${mm} UTC`;
};
