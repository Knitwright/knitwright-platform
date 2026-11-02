import type { Player, StoredPlayer } from "../roster";
import type { WearerGroup } from "../wording";
import { WEARER_GROUPS } from "../wording";
import type { SignupEntry } from "./grid";
import { matchKey } from "./paste";

/**
 * Folding what the players sent into the season's roster (spec F-T4, plan v5 Z7, decision 0086).
 *
 * The roster is written by the club workspace's own function (`replace_season_roster`, decision
 * 0042), so nothing here writes to `roster_players`: this builds the list that function is given.
 * That keeps one writer for a roster and one shape for a player, and it means the roster's own
 * rules — the name cleaner, the 1000-player limit, the wearer groups — go on applying unchanged.
 *
 * Matching is by the folded name, which is what the sign-up page matched a player to the club's
 * list by, so a player who answers twice replaces their own line and never adds a second.
 */

const isWearerGroup = (value: string): value is WearerGroup => WEARER_GROUPS.some((group) => group === value);

export interface MergeResult {
  readonly players: readonly Player[];
  /** How many lines the answers changed, and how many they added. */
  readonly changed: number;
  readonly added: number;
  /** Answers that could not be used, with the reason, so nothing is dropped in silence. */
  readonly skipped: readonly Readonly<{ name: string; reason: string }>[];
}

/**
 * The roster as it would be with the answers folded in: a player already on it keeps their place
 * and takes their new number, size and cut; a player who is not on it is added at the end.
 */
export function mergeIntoRoster(roster: readonly StoredPlayer[], entries: readonly SignupEntry[]): MergeResult {
  const skipped: { name: string; reason: string }[] = [];
  const usable = entries.filter((entry) => {
    if (isWearerGroup(entry.wearerGroup)) return true;
    skipped.push({ name: entry.nameOnShirt, reason: "The cut they chose is not one this club uses." });
    return false;
  });
  const byKey = new Map(usable.map((entry) => [matchKey(entry.nameOnShirt), entry] as const));
  const used = new Set<string>();
  let changed = 0;
  const kept: Player[] = roster.map((player) => {
    const key = matchKey(player.name);
    const entry = byKey.get(key);
    if (!entry) return { name: player.name, number: player.number, sizeLabel: player.sizeLabel, wearerGroup: player.wearerGroup };
    used.add(key);
    const next: Player = {
      name: entry.nameOnShirt,
      number: entry.number,
      sizeLabel: entry.sizeLabel,
      wearerGroup: entry.wearerGroup as WearerGroup,
    };
    if (next.number !== player.number || next.sizeLabel !== player.sizeLabel || next.wearerGroup !== player.wearerGroup || next.name !== player.name) {
      changed += 1;
    }
    return next;
  });
  const fresh = usable
    .filter((entry) => !used.has(matchKey(entry.nameOnShirt)))
    .map((entry) => ({
      name: entry.nameOnShirt,
      number: entry.number,
      sizeLabel: entry.sizeLabel,
      wearerGroup: entry.wearerGroup as WearerGroup,
    }));
  return { players: [...kept, ...fresh], changed, added: fresh.length, skipped };
}

/** One line a club reads before they press the button, so nothing happens that they did not expect. */
export function mergeSummary(result: MergeResult): string {
  const parts: string[] = [];
  if (result.changed > 0) parts.push(`${result.changed} ${result.changed === 1 ? "player" : "players"} updated`);
  if (result.added > 0) parts.push(`${result.added} added`);
  if (parts.length === 0) return "Nothing new to put in the roster.";
  const tail = result.skipped.length === 0 ? "" : ` ${result.skipped.length} could not be used.`;
  return `${parts.join(", ")}.${tail}`;
}
