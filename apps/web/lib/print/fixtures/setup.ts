import { BUILT_IN_GENERATORS, createFakeAssetReader, type ArtworkStack, type AssetReader } from "@/lib/artwork-stack";
import type { GradedPattern, PrintRuleSet, PrintZone, RosterRow } from "@/lib/production/contract";
import { frameFor } from "../frames/frame";
import { fieldBoundsFor } from "../layout/field";
import { buildPieceScene, type BuiltScene } from "../layout/build-scene";
import { createPieceMapper, type PrintMapper } from "../layout/mapper";
import type { PrintSettings } from "../layout/types";
import { buildZones } from "../zones/build";
import { JERSEY_ZONES } from "../zones/templates";
import { gradedJersey } from "./graded";

export const NO_RULES: PrintRuleSet = { minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null };

export const SETTINGS: PrintSettings = {
  bleedMm: 15,
  dpi: 150,
  minDpi: 150,
  scaleX: 1,
  scaleY: 1,
  scaleNote: "Not scaled for shrink: this fabric has no shrink test.",
  defaultsNote: null,
  patternReviewed: false,
};

export interface Rig {
  readonly pattern: GradedPattern;
  readonly mapper: PrintMapper;
  readonly zones: PrintZone[];
  scene(stack: ArtworkStack, size: string, view: string, extra?: Partial<{ settings: PrintSettings; rules: PrintRuleSet; assets: AssetReader; player: RosterRow | null; transferOnly: boolean }>): Promise<BuiltScene>;
}

/** A pattern, its mapper and zones, and a way to lay out one piece. For tests. */
export function rig(sizes?: readonly string[]): Rig {
  const pattern = gradedJersey(sizes);
  const mapper = createPieceMapper(pattern);
  const zones = buildZones(JERSEY_ZONES, pattern, mapper.anchors);
  return {
    pattern,
    mapper,
    zones,
    scene: (stack, size, view, extra = {}) => {
      const placed = mapper.placed(size).find((entry) => entry.instance.id === view);
      if (!placed) throw new Error(`No ${view} in size ${size}`);
      return buildPieceScene({
        stack,
        colourwayId: "main",
        instance: placed.instance,
        frame: frameFor(placed.instance, mapper.anchors),
        anchors: (mapper.anchors[placed.instance.view] ?? {}) as never,
        zones,
        field: fieldBoundsFor(mapper.placed(size), mapper.anchors.front?.underarm?.y ?? 0),
        settings: extra.settings ?? SETTINGS,
        rules: extra.rules ?? NO_RULES,
        generators: BUILT_IN_GENERATORS,
        assets: extra.assets ?? createFakeAssetReader([]),
        player: extra.player ?? null,
        ...(extra.transferOnly ? { transferOnly: true } : {}),
      });
    },
  };
}
