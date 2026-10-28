import type { LogEvent } from "@/lib/server/core/guard";
import { MICRODOLLARS_PER_DOLLAR } from "./cost";

/**
 * Alerts to the owner about the safety ceiling on AI spend, at half and at full. The
 * database decides when each is due, once a day for each ceiling.
 *
 * No email provider exists yet, so the only implementation writes a warning to the
 * server log. Sending it by email is owed (see OWNER-QUESTIONS.md).
 */

export type CeilingAlert = Readonly<{
  level: "half" | "full";
  /** The day's total across everyone, in microdollars. */
  spent: number;
  ceiling: number;
}>;

export type UsageAlert = (alert: CeilingAlert) => Promise<void>;

const dollars = (value: number): string => `$${(value / MICRODOLLARS_PER_DOLLAR).toFixed(2)}`;

const describe = ({ level, spent, ceiling }: CeilingAlert): string =>
  level === "half"
    ? `AI spend today has reached half the safety ceiling: ${dollars(spent)} of ${dollars(ceiling)}.`
    : `AI spend today has reached the safety ceiling: ${dollars(spent)} of ${dollars(ceiling)}. Paid calls are refused until midnight UTC.`;

export const loggingAlert =
  (log: (event: LogEvent) => void): UsageAlert =>
  async (alert) => {
    log({ level: "warn", where: "usage", message: describe(alert) });
  };

/** What monitoring is told when the day's ceiling is reached (lib/monitoring, plan step 26). */
type CeilingHit = Readonly<{ scope: "total"; spentMicros: number; ceilingMicros: number }>;

/**
 * The usual alert, then, when the ceiling across everyone is reached, the monitoring hook, so
 * the owner hears of it from monitoring as well as the log. Half the ceiling stays a warning.
 */
export const withCeilingHook =
  (alert: UsageAlert, onCeiling: (hit: CeilingHit) => Promise<void>): UsageAlert =>
  async (raised) => {
    await alert(raised);
    if (raised.level === "full") await onCeiling({ scope: "total", spentMicros: raised.spent, ceilingMicros: raised.ceiling });
  };
