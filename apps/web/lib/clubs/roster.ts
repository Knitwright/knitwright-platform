import { z } from "zod";
import { parseRosterCsv, type ColumnMapping, type ImportProblem } from "@/lib/orders/import-csv";
import { cleanName } from "@/lib/orders/text";
import { ROSTER_PLAYERS_MAX, WEARER_GROUPS, WEARER_LABELS, type WearerGroup } from "./wording";

/**
 * A season roster: one line per player with a name, a number, a size and a wearer group. Player
 * names are personal data. They are cleaned with the same rule as team orders (decision 0027), and
 * they live only in `roster_players`, which is removed with its season or its club.
 */
export { ROSTER_PLAYERS_MAX, WEARER_GROUPS, WEARER_LABELS, type WearerGroup };

const playerName = z
  .string()
  .max(200)
  .transform((raw, ctx) => {
    const cleaned = cleanName(raw);
    if (cleaned.ok) return cleaned.name;
    ctx.addIssue({ code: "custom", message: cleaned.message });
    return z.NEVER;
  });

export const playerSchema = z
  .object({
    name: playerName,
    /** Digits as printed, so "07" and "7" stay different. Empty until the player has one. */
    number: z.string().trim().regex(/^([0-9]{1,3})?$/, "A number is 1 to 3 digits."),
    sizeLabel: z.string().trim().min(1, "Choose a size.").max(16),
    wearerGroup: z.enum(WEARER_GROUPS),
  })
  .readonly();
export type Player = z.output<typeof playerSchema>;

export const playersSchema = z.array(playerSchema).max(ROSTER_PLAYERS_MAX, `A roster holds up to ${ROSTER_PLAYERS_MAX} players.`).readonly();

type RosterRead =
  | Readonly<{ ok: true; players: readonly Player[]; problems: readonly ImportProblem[]; notes: readonly string[]; headers: readonly string[]; mapping: ColumnMapping }>
  | Readonly<{ ok: false; message: string; needsMapping: boolean; headers: readonly string[]; mapping: ColumnMapping }>;

/**
 * Plain-language notes on a roster that is not wrong but may not be meant: a number used twice.
 * Nothing is changed.
 */
export function rosterNotes(players: readonly Player[]): readonly string[] {
  const seen = new Map<string, number>();
  for (const player of players) if (player.number !== "") seen.set(player.number, (seen.get(player.number) ?? 0) + 1);
  return [...seen]
    .filter(([, count]) => count > 1)
    .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
    .map(([number, count]) => `Number ${number} is used ${count} times.`);
}

/** Reads a roster from CSV text with the same reader team orders use. A player's quantity is ignored: one line is one player. */
export function readRosterCsv(
  text: string,
  options: Readonly<{ header?: boolean; mapping?: ColumnMapping; run?: readonly string[] }> = {},
): RosterRead {
  const result = parseRosterCsv(text, {
    ...(options.header === undefined ? {} : { header: options.header }),
    ...(options.mapping === undefined ? {} : { mapping: options.mapping }),
    ...(options.run === undefined ? {} : { run: options.run }),
  });
  if (!result.ok) return { ok: false, message: result.message, needsMapping: result.needsMapping, headers: result.headers, mapping: result.mapping };
  const players = result.rows.map((row) => ({ name: row.name, number: row.number, sizeLabel: row.sizeLabel, wearerGroup: row.cut }));
  const notes = rosterNotes(players);
  return { ok: true, players, problems: result.problems, notes, headers: result.headers, mapping: result.mapping };
}

const playerRow = z.object({
  id: z.uuid(),
  name: z.string(),
  number: z.string(),
  size_label: z.string(),
  wearer_group: z.enum(WEARER_GROUPS),
});

export type StoredPlayer = Player & Readonly<{ id: string }>;

export const playersFromRows = (rows: unknown): readonly StoredPlayer[] =>
  z.array(playerRow).parse(rows ?? []).map((r) => ({ id: r.id, name: r.name, number: r.number, sizeLabel: r.size_label, wearerGroup: r.wearer_group }));
