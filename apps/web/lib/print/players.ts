import type { PlayerMarkLayer, ArtworkStack, ViewId } from "@/lib/artwork-stack";
import type { RosterRow, SizeLabelMap, TeamOrder } from "@/lib/production/contract";
import type { PlayerTag } from "./layout/scene";

export interface PlayerJob {
  /** The player's place in the roster, from 1. */
  readonly index: number;
  readonly row: RosterRow;
  readonly player: PlayerTag;
  readonly label: string;
  /** The pattern size the label is cut from. */
  readonly size: string;
  /** The views that carry this player's name or number. */
  readonly views: readonly ViewId[];
  /** True when the marks are made by transfer, so the name and number alone are wanted as well. */
  readonly transfer: boolean;
}

export interface PlayerPlan {
  readonly jobs: readonly PlayerJob[];
  /** Plain sentences for every row that could not be planned. */
  readonly problems: readonly string[];
}

const WEARER_OF_CUT: Readonly<Record<RosterRow["cut"], SizeLabelMap["wearer"]>> = { mens: "men", womens: "women", junior: "youth", unisex: "men" };

/** The pattern size a label is cut from: the map for its cut, else the map for its wearer. Null when no map has it. */
export function patternSizeFor(maps: readonly SizeLabelMap[], label: string, cut: RosterRow["cut"]): string | null {
  const exact = maps.find((m) => m.label === label && m.cut === cut);
  const byWearer = maps.find((m) => m.label === label && m.wearer === WEARER_OF_CUT[cut]);
  return (exact ?? byWearer)?.patternSize ?? null;
}

const markLayers = (stack: ArtworkStack): PlayerMarkLayer[] => stack.layers.filter((l): l is PlayerMarkLayer => l.kind === "player-mark");

export interface PlanInput {
  readonly order: TeamOrder;
  readonly stack: ArtworkStack;
  readonly sizeMaps: readonly SizeLabelMap[];
  readonly patternSizes: readonly string[];
}

/** One set per roster row. A row that cannot be planned is reported with its reason, never skipped silently or guessed. */
export function planPlayers(input: PlanInput): PlayerPlan {
  const marks = markLayers(input.stack);
  if (marks.length === 0) return { jobs: [], problems: ["This design has no place for a name or number, so there is nothing to make for each player."] };
  const views = [...new Set(marks.flatMap((m) => m.views))];
  const transfer = marks.some((m) => m.technique === "transfer");
  const jobs: PlayerJob[] = [];
  const problems: string[] = [];
  input.order.rows.forEach((row, at) => {
    const who = `${row.name === "" ? "Player" : row.name} (number ${row.number})`;
    const size = patternSizeFor(input.sizeMaps, row.sizeLabel, row.cut);
    if (size === null) problems.push(`${who}: there is no pattern size for the label ${row.sizeLabel} in the ${row.cut} cut.`);
    else if (!input.patternSizes.includes(size)) problems.push(`${who}: the label ${row.sizeLabel} is cut from size ${size}, and this pattern has no size ${size}.`);
    else jobs.push({ index: at + 1, row, player: { name: row.name, number: row.number }, label: row.sizeLabel, size, views, transfer });
  });
  return { jobs, problems };
}

/** A name for a player's folder: the place in the roster, the number and the name, in characters any zip and any system keeps. */
export function playerFileStem(input: { index: number; player: PlayerTag }): string {
  const name = input.player.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [String(input.index).padStart(2, "0"), input.player.number, name].filter((part) => part !== "").join("-");
}
