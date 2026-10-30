/**
 * What Brand Studio accepts from a browser (spec F-S9). Every limit is the one the database holds,
 * so a screen and the database can never disagree. Only the server imports this file.
 */

import { z } from "zod";
import { ASSET_KINDS, BRAND_CATEGORIES, FONT_ROLES, LIMITS, VOICE_TAGS } from "./words";

const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((text) => !/[\p{Cc}]/u.test(text), "Leave out control characters.");

/** Free text that may run over several lines, such as About or a visual-style text. */
const paragraph = (max: number) =>
  z
    .string()
    .max(max)
    .refine((text) => !/[^\p{L}\p{N}\p{P}\p{S}\p{Zs}\n\r\t]/u.test(text), "Leave out control characters.");

export const hexSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Use a colour like #0b3d91.");

/** `https://…` only. A brand that has no website leaves it empty, and nothing is guessed. */
const websiteSchema = z
  .string()
  .trim()
  .max(LIMITS.website)
  .refine((text) => text === "" || /^https?:\/\/[^\s]+\.[^\s]+$/.test(text), "Start with https:// and include a dot.")
  .transform((text) => (text === "" ? null : text));

const sizeLabelSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ./+-]{0,15}$/, "A size label is 1 to 16 letters, digits, spaces or . / + -.");

export const profileSchema = z
  .object({
    category: z.enum(BRAND_CATEGORIES),
    website: websiteSchema,
    about: paragraph(LIMITS.about),
    voiceTags: z.array(z.enum(VOICE_TAGS)).max(VOICE_TAGS.length),
    setting: paragraph(LIMITS.styleText),
    artDirection: paragraph(LIMITS.styleText),
    rulesBoundaries: paragraph(LIMITS.styleText),
    defaultSizeRange: z.array(sizeLabelSchema).max(20),
  })
  // The same tag twice would fail the database's own check, so it is taken out here.
  .transform((input) => ({ ...input, voiceTags: [...new Set(input.voiceTags)], defaultSizeRange: [...new Set(input.defaultSizeRange)] }));
export type ProfileBody = z.output<typeof profileSchema>;

const colourSchema = z.object({
  name: line(LIMITS.colourName),
  hex: hexSchema,
  /** As the brand typed it. No Pantone data ships, so nothing is worked out from the hex. */
  pantoneTcx: line(LIMITS.pantone).transform((text) => (text === "" ? null : text)),
});

export const paletteSchema = z.object({
  paletteId: z.uuid().nullable(),
  name: line(LIMITS.paletteName).min(1, "Give the palette a name."),
  colours: z.array(colourSchema).max(LIMITS.coloursPerPalette, `A palette holds up to ${LIMITS.coloursPerPalette} colours.`),
});
export type PaletteBody = z.output<typeof paletteSchema>;

export const deletePaletteSchema = z.object({ paletteId: z.uuid() });

export const fontsSchema = z.object({
  fonts: z
    .array(z.object({ role: z.enum(FONT_ROLES), fontKey: z.string().trim().max(40).nullable() }))
    .max(FONT_ROLES.length)
    .refine((rows) => new Set(rows.map((row) => row.role)).size === rows.length, "Each role appears once."),
});
export type FontsBody = z.output<typeof fontsSchema>;

const assetSchema = z.object({
  artworkId: z.uuid(),
  label: line(LIMITS.assetLabel).min(1, "Give the picture a name."),
  sponsorName: line(LIMITS.sponsorName).transform((text) => (text === "" ? null : text)),
  /** The width the brand wants it printed at. Null means it has not said, and nothing is assumed. */
  printWidthMm: z.number().positive().max(2000).nullable(),
});

export const assetsSchema = z
  .object({ kind: z.enum(ASSET_KINDS), assets: z.array(assetSchema).max(Math.max(...Object.values(LIMITS.assetsPerKind))) })
  .refine((input) => input.assets.length <= LIMITS.assetsPerKind[input.kind], "That is more pictures than a brand may hold of that kind.");
export type AssetsBody = z.output<typeof assetsSchema>;

/** The rows Brand Studio reads back, so a row that no longer fits the rules cannot break a page. */
export const profileRow = z.object({
  category: z.enum(BRAND_CATEGORIES),
  kind: z.enum(["club", "brand"]),
  website: z.string().nullable(),
  about: z.string(),
  voice_tags: z.array(z.string()),
  setting: z.string(),
  art_direction: z.string(),
  rules_boundaries: z.string(),
  default_size_range: z.array(z.string()),
});

export const paletteRow = z.object({
  id: z.uuid(),
  name: z.string(),
  brand_colours: z.array(z.object({ id: z.uuid(), name: z.string(), hex: z.string(), pantone_tcx: z.string().nullable(), position: z.number().int() })),
});

export const fontRow = z.object({ role: z.enum(FONT_ROLES), font_key: z.string() });

export const assetRow = z.object({
  id: z.uuid(),
  kind: z.enum(ASSET_KINDS),
  artwork_id: z.uuid(),
  label: z.string(),
  sponsor_name: z.string().nullable(),
  print_width_mm: z.union([z.number(), z.string()]).nullable(),
  position: z.number().int(),
});

export const kitFontRow = z.object({
  key: z.string(),
  label: z.string(),
  family: z.string(),
  licence: z.enum(["bundled", "not_established"]),
  licence_note: z.string(),
  selectable: z.boolean(),
});

export const artworkRow = z.object({
  id: z.uuid(),
  label: z.string(),
  kind: z.enum(["raster", "vector"]),
  width_px: z.number().int(),
  height_px: z.number().int(),
});
