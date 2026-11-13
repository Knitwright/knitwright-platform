import type { Tone } from "@/components/ui/Chips";
import type { StoredPlayer } from "@/lib/clubs/roster";
import type { Grid } from "@/lib/clubs/signup/grid";
import type { CommitteeLink } from "@/lib/share/committee/service";
import { countBySlot } from "@/lib/share/committee/tally";

/**
 * What the Team page shows (09 screen 17, d18; plan v6 P6, decision 0144), worked out from the club's
 * roster, its sign-up grid and its committee links. Pure, so every line is tested apart from the page.
 */

export const TEAM_TABS = ["roster", "approvals", "seasons", "stores"] as const;
export type TeamTab = (typeof TEAM_TABS)[number];

/** What the Roster tab shows under its table: the editor (Add player, Import CSV) or the sign-up link. */
export const ROSTER_VIEWS = ["edit", "signup"] as const;
export type RosterView = (typeof ROSTER_VIEWS)[number];

const pick = <T extends string>(options: readonly T[], value: unknown): T | null =>
  options.find((option) => option === value) ?? null;

export const teamTabFrom = (value: unknown): TeamTab => pick(TEAM_TABS, value) ?? "roster";
export const rosterViewFrom = (value: unknown): RosterView | null => pick(ROSTER_VIEWS, value);

export interface RosterRow {
  readonly key: string;
  /** The name as it is printed: upper case. */
  readonly shirtName: string;
  readonly number: string;
  readonly size: string;
  readonly status: string;
  readonly tone: Tone;
  /** True while the club is still waiting on this person's details. */
  readonly waiting: boolean;
}

const repeated = (numbers: readonly string[]): ReadonlySet<string> => {
  const seen = new Map<string, number>();
  for (const number of numbers) if (number !== "") seen.set(number, (seen.get(number) ?? 0) + 1);
  return new Set([...seen].filter(([, count]) => count > 1).map(([number]) => number));
};

/**
 * One row per player in the roster, then one per person the sign-up is still waiting on. A player is
 * "Collected"; a repeated number is flagged and kept (F-T4: only the club knows whether two teams share
 * it); someone not in yet is "Waiting", with no size.
 */
export function rosterRows(players: readonly StoredPlayer[], grid: Grid | null): readonly RosterRow[] {
  const twice = repeated(players.map((player) => player.number));
  const inRoster: RosterRow[] = players.map((player) => ({
    key: player.id,
    shirtName: player.name.toUpperCase(),
    number: player.number,
    size: player.sizeLabel || "—",
    status: twice.has(player.number) ? "Duplicate number" : "Collected",
    tone: twice.has(player.number) ? "warn" : "ok",
    waiting: false,
  }));
  const waiting: RosterRow[] = (grid?.rows ?? [])
    .filter((row) => row.state === "missing")
    .map((row) => ({ key: `waiting-${row.key}`, shirtName: row.name.toUpperCase(), number: "", size: "—", status: "Waiting", tone: "warn", waiting: true }));
  return [...inRoster, ...waiting];
}

export interface ApprovalSummary {
  readonly line: string;
  /** "3 approvals from 5", against everyone who answered; or null before anyone answered. */
  readonly pill: string | null;
  readonly locked: boolean;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const DAY_MS = 86_400_000;

/**
 * The committee card under the roster (d18): votes per version, comments and when the link expires,
 * read from the newest live link of a design. `now` is passed in so the days left are testable.
 */
export function approvalSummary(links: readonly CommitteeLink[], lockedVersion: number | null, now: Date): ApprovalSummary {
  const link = links.find((entry) => entry.revokedAt === null) ?? null;
  if (!link) return { line: "No committee link yet.", pill: null, locked: lockedVersion !== null };
  const counts = countBySlot(link.slots, link.votes, link.approvals);
  const votes = counts.map((count) => `Version ${count.version} ${plural(count.votes, "vote", "votes")}`);
  const days = Math.ceil((Date.parse(link.expiresAt) - now.getTime()) / DAY_MS);
  const expiry = days > 0 ? `link expires in ${plural(days, "day", "days")}` : "link expired";
  const voters = new Set(link.votes.map((vote) => vote.name)).size;
  const approved = link.approvals.length;
  return {
    line: [...votes, plural(link.pins.length, "comment", "comments"), expiry].join(" · "),
    pill: voters + approved === 0 ? null : `${plural(approved, "approval", "approvals")} from ${Math.max(voters, approved)}`,
    locked: lockedVersion !== null,
  };
}

/** What the Seasons tab says about the roster-retention opt-in. */
export const retentionLine = (keep: boolean): string =>
  keep
    ? "Rosters are kept after two seasons, because your club opted in."
    : "Rosters older than two seasons are removed automatically, with their players' names, numbers and sizes.";
