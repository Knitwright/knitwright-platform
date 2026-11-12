import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";

/**
 * The roster purge (spec 05 security and 03 data model: "rosters older than 2 seasons are purged unless the club
 * opts in"; plan v6 D5, decision 0136).
 *
 * `purge_old_rosters` in the database decides which seasons are past keeping (two newer seasons, or ended more than
 * two years ago), skips a club that opted in, and removes those seasons' players, sign-up requests, answers and
 * links. It is idempotent: a second run finds nothing. This module runs it and says what it did.
 *
 * The scheduler reaches it through `app/api/cron/roster-purge` with the deploy's CRON_SECRET, the door decision
 * 0100 built for the weekly cut.
 */

/** The address the scheduler calls, as written in `vercel.json`. */
export const ROSTER_PURGE_PATH = "/api/cron/roster-purge";
/** Once a day, at 03:30 UTC. Daily is enough: nothing turns two seasons old by the hour. */
export const ROSTER_PURGE_SCHEDULE = "30 3 * * *";

export const PURGE_SWITCHED_OFF = "This deploy has no cron secret set, so the roster purge is switched off.";
export const PURGE_FAILED = "The roster purge did not run.";

export interface PurgeRun {
  readonly seasonsPurged: number;
  readonly playersRemoved: number;
  readonly requestsRemoved: number;
  readonly entriesRemoved: number;
}

type Admin = Pick<SupabaseClient, "rpc">;

interface PurgeRow {
  seasons_purged: number;
  players_removed: number;
  requests_removed: number;
  entries_removed: number;
}

/** Runs the purge across every club. Calling it twice removes nothing the second time. */
export async function runRosterPurge(admin: Admin, now?: Date): Promise<PurgeRun> {
  const { data, error } = await admin.rpc("purge_old_rosters", { ...(now ? { p_now: now.toISOString() } : {}) });
  const row = (Array.isArray(data) ? data[0] : data) as PurgeRow | undefined | null;
  if (error || !row) throw new AppError("internal", PURGE_FAILED, undefined, { cause: error ?? undefined });
  return {
    seasonsPurged: row.seasons_purged,
    playersRemoved: row.players_removed,
    requestsRemoved: row.requests_removed,
    entriesRemoved: row.entries_removed,
  };
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The sentence the route answers with. */
export function describePurge(run: PurgeRun): string {
  if (run.seasonsPurged === 0) return "No roster was older than two seasons, so nothing was removed.";
  const seasons = run.seasonsPurged === 1 ? "the roster of 1 season" : `the rosters of ${run.seasonsPurged} seasons`;
  return (
    `Removed ${seasons} older than two seasons: ${count(run.playersRemoved, "player", "players")}, ` +
    `${run.requestsRemoved} people waited on and ${count(run.entriesRemoved, "sign-up answer", "sign-up answers")}.`
  );
}

/** What the route answers when the cron secret does not admit the call: the purge's own words for a missing secret. */
export function purgeRefusal(admission: Readonly<{ ok: false; status: 404 | 503; reason: string }>): {
  status: 404 | 503;
  error: string;
} {
  return admission.status === 503 ? { status: 503, error: PURGE_SWITCHED_OFF } : { status: 404, error: admission.reason };
}
