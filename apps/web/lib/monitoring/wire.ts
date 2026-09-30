import type { LogEvent } from "@/lib/server/core/guard";

/**
 * Joins the server log to monitoring. The request wrappers log every unexpected failure at error
 * level, so this is where their error path reaches monitoring.
 */

type Parts = Readonly<{
  log: (event: LogEvent) => void;
  report: (event: LogEvent) => Promise<void>;
  /** Runs work after the response is sent. In the app this is Next.js `after`. */
  schedule: (work: () => Promise<void>) => void;
}>;

export const logAndReport =
  ({ log, report, schedule }: Parts) =>
  (event: LogEvent): void => {
    log(event);
    if (event.level !== "error") return;
    try {
      schedule(() => report(event));
    } catch {
      // Outside a request there is no response to wait for, so send now. `report` never throws.
      void report(event);
    }
  };

export type SpendScope = "user" | "brand" | "total";

export type SpendCeilingHit = Readonly<{
  scope: SpendScope;
  spentMicros: number;
  ceilingMicros: number;
  /** The user or brand id, for "user" and "brand". Never a name or an address. */
  subjectId?: string;
}>;

/**
 * The hook the usage meter calls when a spend ceiling is reached (plan step 26, task 4). It logs
 * at error level and reports to monitoring. Where the alert goes after that (email, chat) is the
 * owner's decision and is set up in the monitoring service, not here.
 */
export const createSpendAlert =
  ({ log, report }: Pick<Parts, "log" | "report">) =>
  async (hit: SpendCeilingHit): Promise<void> => {
    const who = hit.subjectId ? `${hit.scope} ${hit.subjectId}` : hit.scope;
    const event: LogEvent = {
      level: "error",
      message: `AI spend ceiling reached: ${who} spent ${hit.spentMicros} of ${hit.ceilingMicros} microdollars`,
      where: "spend-ceiling",
    };
    log(event);
    await report(event);
  };
