import type { ArtworkStack } from "@/lib/artwork-stack";
import type { FabricProfile, GradedPattern, PrintFileSpec, PrintProfile, RosterRow } from "@/lib/production/contract";
import { instancesOf, type PieceInstance, type PieceRoles } from "../frames/instances";
import { EXTENSIONS, fileStem } from "./names";
import { scaleForPiece } from "./shrink";

export type Format = PrintFileSpec["format"];

/** One file to make: its place in the zip, what it is made from, and whether it is the marks alone. */
export interface PlanEntry {
  readonly path: string;
  readonly spec: PrintFileSpec;
  readonly transferOnly: boolean;
  readonly player: RosterRow | null;
}

interface PlanInput {
  readonly pattern: GradedPattern;
  readonly stack: ArtworkStack;
  readonly sizes: readonly string[];
  readonly formats: readonly Format[];
  readonly profile: PrintProfile;
  readonly shrink?: Pick<FabricProfile, "shrinkLengthPct" | "shrinkWidthPct">;
  readonly roster?: { readonly rows: readonly RosterRow[] } | null;
  /** The pattern size a roster row is cut from. Null when the row's size has no pattern size. */
  readonly sizeFor?: (row: RosterRow) => string | null;
  readonly roles?: PieceRoles;
}

export interface Plan {
  readonly entries: readonly PlanEntry[];
  /** Roster rows left out, with the reason in a sentence. */
  readonly skipped: readonly string[];
}

/** Most files one request may plan. The route refuses more. */
export const MAX_PLAN_FILES = 600;

function specFor(instance: PieceInstance, input: PlanInput, format: Format, player: RosterRow | null): PrintFileSpec {
  const scale = scaleForPiece(instance.piece, input.shrink);
  return {
    pieceId: instance.id,
    size: instance.size,
    ...(player ? { playerNumber: player.number } : {}),
    format,
    bleedMm: input.profile.bleedMm,
    scaleX: scale.scaleX,
    scaleY: scale.scaleY,
    dpi: input.profile.dpi,
    profile: input.profile,
  };
}

const hasMarks = (stack: ArtworkStack, view: string, transfer: boolean): boolean =>
  stack.layers.some((layer) => layer.kind === "player-mark" && layer.views.includes(view as never) && (!transfer || layer.technique === "transfer"));

/**
 * Every file for the sizes asked: each piece in each size without names, then, for each roster row, the pieces that
 * carry the player's name or number, and the marks alone when the marks are transfers.
 */
export function planPrintFiles(input: PlanInput): Plan {
  const entries: PlanEntry[] = [];
  const skipped: string[] = [];
  const instancesBySize = new Map(input.pattern.sizes.map((size) => [size, instancesOf(input.pattern.piecesBySize[size] ?? [], size, input.roles).instances]));
  const add = (size: string, instance: PieceInstance, player: RosterRow | null, transferOnly: boolean): void => {
    for (const format of input.formats) {
      entries.push({ path: `${size}/${fileStem(instance.id, player, transferOnly)}.${EXTENSIONS[format]}`, spec: specFor(instance, input, format, player), transferOnly, player });
    }
  };
  for (const size of input.sizes) for (const instance of instancesBySize.get(size) ?? []) add(size, instance, null, false);
  for (const row of input.roster?.rows ?? []) {
    const size = input.sizeFor ? input.sizeFor(row) : row.sizeLabel;
    const found = size === null ? undefined : instancesBySize.get(size);
    if (!size || !found) {
      skipped.push(`${row.name === "" ? "Number " + row.number : row.name}: size ${row.sizeLabel} has no pattern size, so no files were made.`);
      continue;
    }
    if (!input.sizes.includes(size)) continue;
    for (const instance of found) {
      if (hasMarks(input.stack, instance.view, false)) add(size, instance, row, false);
      if (hasMarks(input.stack, instance.view, true)) add(size, instance, row, true);
    }
  }
  return { entries, skipped };
}
