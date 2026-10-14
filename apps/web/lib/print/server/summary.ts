import { describeStack } from "@/lib/artwork-stack";
import { DEFAULT_LABEL } from "../layout/context";
import { rulesAreEmpty, EMPTY_RULES_SENTENCE } from "../rules";
import { buildZones } from "../zones";
import { prepare, type PrintDeps, type PrintInput } from "./serve";
import { scaleNote } from "../layout/notes";

export interface PieceSummary {
  readonly view: string;
  readonly pieceId: string;
  readonly name: string;
  /** The whole cut outline at the pattern's base size, in the pattern file's millimetres. */
  readonly outline: readonly (readonly [number, number])[];
  readonly zones: readonly { readonly id: string; readonly purpose: string; readonly polygon: readonly (readonly [number, number])[] }[];
}

export interface PrintSummary {
  readonly design: string;
  readonly sizes: readonly string[];
  readonly baseSize: string;
  readonly patternDescription: string;
  readonly patternReviewed: boolean;
  readonly settings: { readonly bleedMm: number; readonly dpi: number; readonly minDpi: number; readonly label: string; readonly colourProfile: string };
  readonly scale: string;
  readonly rules: string;
  readonly colourways: readonly { readonly id: string; readonly name: string }[];
  readonly artwork: string;
  readonly pieces: readonly PieceSummary[];
}

/** What the print panel shows before anything is built: the pattern, the settings the files would use, and where the zones are. */
export async function printSummary(deps: PrintDeps, input: PrintInput): Promise<PrintSummary> {
  const { project, source, stack, env } = await prepare(deps, input);
  const size = source.baseSize;
  const zones = buildZones(env.mapper, [size]);
  const pieces = env.mapper.views(size).flatMap((view) => {
    const frame = env.mapper.frame(view, size);
    if (frame === null) return [];
    return [
      {
        view,
        pieceId: frame.pieceId,
        name: frame.opened.piece.name,
        outline: frame.opened.outline.map(([x, y]) => [x, y] as const),
        zones: zones.filter((z) => z.pieceId === frame.pieceId && polygonOnView(env.zoneTemplates, z.id, view)).map((z) => ({ id: z.id, purpose: z.purpose, polygon: (z.polygonBySize[size] ?? []).map(([x, y]) => [x, y] as const) })),
      },
    ];
  });
  const fromDefaults = env.settings.source === "knitwright-default";
  return {
    design: project.name,
    sizes: source.pattern.sizes,
    baseSize: size,
    patternDescription: source.description,
    patternReviewed: source.reviewed,
    settings: {
      bleedMm: env.settings.bleedMm,
      dpi: env.settings.dpi,
      minDpi: env.settings.minDpi,
      label: fromDefaults ? DEFAULT_LABEL : "From your print house",
      colourProfile: env.settings.iccBytes === null ? "No colour profile set: colours are sRGB." : `Colour profile: ${env.settings.iccName ?? "from your print house"}.`,
    },
    scale: scaleNote(env),
    rules: rulesAreEmpty(env.rules) ? EMPTY_RULES_SENTENCE : "League rules are set for this download.",
    colourways: stack.colourways.map((c) => ({ id: c.id, name: c.name })),
    artwork: describeStack(stack, env.colourwayId),
    pieces,
  };
}

const polygonOnView = (templates: readonly { id: string; view: string }[], zoneId: string, view: string): boolean => templates.find((t) => t.id === zoneId)?.view === view;
