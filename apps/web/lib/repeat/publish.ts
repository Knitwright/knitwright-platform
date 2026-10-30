import { z } from "zod";
import { publishBlocked, repeatFindings, type RepeatFinding } from "./findings";
import { repeatPeriod } from "./tiling";
import { COLOUR_PATTERN, DRAWN_SHAPES, REPEAT_STYLES, TILE_UNITS, type RepeatDraft } from "./types";
import { TILE_MAX_TENTHS, TILE_MIN_TENTHS } from "./units";

/**
 * Publishing a repeat to Your library (spec F-S4 "Publish saves it to Your library").
 *
 * The browser sends the recipe, not a picture: the tile's size, its style, its background and its
 * layers. Each picture layer names an artwork already in the brand's library, which went through
 * moderation on the way in (X8 `screenUpload`), so publishing cannot bring in an unscreened
 * picture. The server checks the recipe against this schema again and the database checks it a
 * third time.
 */

const colour = z.string().regex(COLOUR_PATTERN, "Pick a colour like #1b2a49.");
const side = z.number().int().min(TILE_MIN_TENTHS).max(TILE_MAX_TENTHS);
const inside = z.number().int().min(0).max(TILE_MAX_TENTHS);
const size = z.number().int().min(1).max(TILE_MAX_TENTHS);

const layerSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().trim().min(1, "Name the layer.").max(80),
    artworkId: z.uuid("That is not a picture in your library.").nullable(),
    shape: z.enum(DRAWN_SHAPES).nullable(),
    colour,
    xTenths: inside,
    yTenths: inside,
    widthTenths: size,
    heightTenths: size,
    rotationDeg: z.number().int().min(0).max(359),
  })
  .refine((layer) => (layer.artworkId === null) !== (layer.shape === null), {
    message: "A layer draws either a picture from your library or a shape, never both and never neither.",
    path: ["artworkId"],
  });

export const publishRepeatSchema = z.object({
  name: z.string().trim().min(1, "Give the repeat a name.").max(80),
  unit: z.enum(TILE_UNITS),
  style: z.enum(REPEAT_STYLES),
  tileWidthTenths: side,
  tileHeightTenths: side,
  background: colour,
  wrap: z.boolean(),
  layers: z.array(layerSchema).min(1, "Put something on the tile first.").max(24),
});

/** The recipe as it is sent and as it is stored. */
export type PublishRepeatInput = z.output<typeof publishRepeatSchema>;

/** The recipe a draft publishes as, with the layer fields the library does not keep left out. */
export function publishInput(draft: RepeatDraft): PublishRepeatInput {
  return {
    name: draft.name.trim(),
    unit: draft.unit,
    style: draft.style,
    tileWidthTenths: draft.tile.widthTenths,
    tileHeightTenths: draft.tile.heightTenths,
    background: draft.background,
    wrap: draft.wrap,
    layers: draft.layers.map((layer) => ({
      id: layer.id,
      label: layer.label.trim(),
      artworkId: layer.artworkId,
      shape: layer.shape,
      colour: layer.colour,
      xTenths: layer.xTenths,
      yTenths: layer.yTenths,
      widthTenths: layer.widthTenths,
      heightTenths: layer.heightTenths,
      rotationDeg: layer.rotationDeg,
    })),
  };
}

export type Publishable =
  | Readonly<{ ok: true; input: PublishRepeatInput; findings: readonly RepeatFinding[] }>
  | Readonly<{ ok: false; findings: readonly RepeatFinding[] }>;

/**
 * The draft as something to publish, or the reasons it cannot be. Warnings come back either way:
 * a repeat with a layer under the resolution bar may still be published, and the person is told.
 */
export function publishable(draft: RepeatDraft): Publishable {
  const findings = repeatFindings(draft);
  if (publishBlocked(draft)) return { ok: false, findings };
  const checked = publishRepeatSchema.safeParse(publishInput(draft));
  if (!checked.success) {
    const first = checked.error.issues[0];
    return {
      ok: false,
      findings: [
        ...findings,
        { code: "repeat-no-layers", ruleId: "R-GAP-000", severity: "blocker", message: first?.message ?? "This repeat cannot be published yet.", action: "Change it and try again.", layerId: null },
      ],
    };
  }
  return { ok: true, input: checked.data, findings };
}

/** The sentence the panel shows beside Publish: what repeats once, in the unit being typed. */
export function periodSentence(draft: RepeatDraft, text: (tenths: number) => string): string {
  const period = repeatPeriod(draft.style, draft.tile);
  return `Repeats every ${text(period.widthTenths)} across and ${text(period.heightTenths)} down.`;
}
