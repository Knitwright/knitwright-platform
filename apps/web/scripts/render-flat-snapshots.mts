/**
 * Writes the snapshot drawings the owner approves (owner action A6): an SVG and a PNG for
 * every garment type, front and back, into docs/owner/flats/. Run it from apps/web:
 *
 *   pnpm --filter web exec tsx scripts/render-flat-snapshots.mts
 *
 * Tops use MADE-UP sizes and made-up colours, and say so in a visible line. The sizes are
 * not real garment data. They only give the drawing a realistic shape. The other families
 * are drawn with no sizes at all, from the proportions of their templates, and say so.
 * Pass family ids to draw only those families, for example `bottoms outerwear`. Pass
 * `kit-styles` to draw every kit pattern on a jersey and a polo into docs/owner/flats/kit-styles/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getType, KIT_PATTERN_STYLES, type GarmentSpec, type KitPatternStyle } from "@/lib/garment";
import { buildFlat } from "@/lib/flat/build";
import { designWith, madeUpForType, typedIn } from "@/lib/flat/fixtures/designs";
import { renderSvg } from "@/lib/flat/render-svg";
import { withReviewNote } from "@/lib/flat/review-note";
import type { View } from "@/lib/flat/model";

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "owner", "flats");
const NOTE = "Made-up sizes for review of the drawing only";
const PROPORTIONS_NOTE = "No sizes. Drawn from proportions, not to scale. For review of the drawing only";
const PNG_WIDTH = 900;
const VIEWS: readonly View[] = ["front", "back"];

/** Made-up colours, so each panel can be told apart. They are not a colour scheme. */
const REVIEW_COLOURS: Readonly<Record<string, string>> = {
  "body-front": "#dbe4f0",
  "body-back": "#dbe4f0",
  "sleeve-left": "#dbe4f0",
  "sleeve-right": "#dbe4f0",
  neckband: "#1b2a49",
  collar: "#1b2a49",
  placket: "#b8c7dc",
  "side-panels": "#c0392b",
  cuffs: "#1b2a49",
  "legs-front": "#dbe4f0",
  "legs-back": "#dbe4f0",
  waistband: "#1b2a49",
  gusset: "#b8c7dc",
  "side-stripes": "#c0392b",
  hood: "#dbe4f0",
  "hood-lining": "#b8c7dc",
  "kangaroo-pocket": "#c9d5e6",
  "hem-band": "#1b2a49",
  binding: "#1b2a49",
  underband: "#1b2a49",
};

interface Variant {
  readonly name: string;
  readonly typeId: string;
  readonly choices: Readonly<Record<string, string>>;
  /** True to draw with no measurements at all, from proportions only. */
  readonly proportionsOnly?: boolean;
}

/**
 * The families other than tops are drawn with NO measurements, from the proportions of their
 * templates, so no size in these pictures is a measurement of anything.
 */
const variant = (name: string, typeId: string, choices: Readonly<Record<string, string>> = {}): Variant => ({
  name,
  typeId,
  choices,
  proportionsOnly: true,
});

const FAMILY_VARIANTS: readonly Variant[] = [
  variant("shorts", "shorts"),
  variant("joggers", "joggers"),
  variant("leggings", "leggings"),
  variant("track-pants", "track-pants"),
  variant("joggers-loaded", "joggers", { "side-stripe": "contrast-stripe", gusset: "crotch-gusset", pockets: "zip-side" }),
  variant("track-pants-zip", "track-pants", { "leg-finish": "ankle-zip", "side-stripe": "contrast-stripe", waistband: "elastic" }),
  variant("leggings-cropped", "leggings", { "leg-length": "cropped", "side-stripe": "contrast-stripe" }),
  variant("pullover-hoodie", "pullover-hoodie"),
  variant("zip-hoodie", "zip-hoodie"),
  variant("track-jacket", "track-jacket"),
  variant("pullover-hoodie-raglan", "pullover-hoodie", { "sleeve-type": "raglan", hood: "single-layer", "hem-finish": "hem", cuffs: "hem" }),
  variant("zip-hoodie-zip-pockets", "zip-hoodie", { pockets: "zip-side", "hood-drawcord": "none" }),
  variant("track-jacket-no-collar", "track-jacket", { collar: "none", "sleeve-type": "raglan", pockets: "side-seam" }),
  variant("singlet", "singlet"),
  variant("vest", "vest"),
  variant("sports-bra", "sports-bra"),
  variant("compression-top", "compression-top"),
  variant("singlet-racerback", "singlet", { "back-style": "racerback", "seam-type": "flatlock" }),
  variant("sports-bra-straight-bound", "sports-bra", { "back-style": "straight", "edge-finish": "bound", underband: "exposed-elastic" }),
  variant("compression-top-short", "compression-top", { sleeves: "short", "edge-finish": "turned", "seam-type": "overlock" }),
];

const VARIANTS: readonly Variant[] = [
  { name: "crew-tee", typeId: "crew-tee", choices: {} },
  { name: "v-neck-tee", typeId: "v-neck-tee", choices: {} },
  { name: "long-sleeve-tee", typeId: "long-sleeve-tee", choices: {} },
  { name: "polo", typeId: "polo", choices: {} },
  { name: "team-jersey", typeId: "team-jersey", choices: {} },
  {
    name: "team-jersey-loaded",
    typeId: "team-jersey",
    choices: {
      "sleeve-type": "raglan",
      "sleeve-length": "long",
      collar: "band-collar",
      placket: "zip",
      "hem-shape": "curved",
      "side-panels": "contrast-insert",
      cuffs: "rib-cuff",
    },
  },
  { name: "team-jersey-v-raglan", typeId: "team-jersey", choices: { neckline: "v-neck", "sleeve-type": "raglan", "hem-shape": "curved" } },
  { name: "polo-long-zip", typeId: "polo", choices: { placket: "zip", "sleeve-length": "long", cuffs: "rib-cuff", "hem-shape": "side-vent" } },
  ...FAMILY_VARIANTS,
];

function coloured(spec: GarmentSpec): GarmentSpec {
  const type = getType(spec.typeId);
  const panels = new Set(type?.panels.map((panel) => panel.id));
  const colours = Object.entries(REVIEW_COLOURS)
    .filter(([panelId]) => panels.has(panelId))
    .map(([panelId, swatch]) => ({ panelId, colour: "Made-up colour", swatch, provenance: "user-edited" as const }));
  return { ...spec, colourways: [{ ...spec.colourways[0], colours }] } as GarmentSpec;
}

/** Made-up club colours for the kit style review: navy ground, gold and white pattern. Not a colour scheme. */
const KIT_GROUND = "#1b2a49";
const KIT_COLOURS = [
  { colour: "Made-up gold", swatch: "#d4af37" },
  { colour: "Made-up white", swatch: "#ffffff" },
] as const;

/** Every kit pattern style on a jersey and a polo, before (plain) and after, into docs/owner/flats/kit-styles. */
async function renderKitStyles(): Promise<void> {
  const folder = join(OUTPUT, "kit-styles");
  mkdirSync(folder, { recursive: true });
  const garments: readonly { name: string; typeId: string; choices: Readonly<Record<string, string>> }[] = [
    { name: "team-jersey", typeId: "team-jersey", choices: {} },
    { name: "team-jersey-raglan", typeId: "team-jersey", choices: { "sleeve-type": "raglan", "hem-shape": "curved", neckline: "v-neck" } },
    { name: "polo", typeId: "polo", choices: {} },
  ];
  for (const garment of garments) {
    const base = coloured(designWith(garment.typeId, garment.choices, madeUpForType(garment.typeId, garment.choices)));
    const ground = base.colourways[0].colours.map((entry) =>
      entry.panelId.startsWith("body") || entry.panelId.startsWith("sleeve") ? { ...entry, swatch: KIT_GROUND } : entry,
    );
    const plain = { ...base, colourways: [{ ...base.colourways[0], colours: ground }] } as GarmentSpec;
    const styles: readonly (KitPatternStyle | "plain")[] = ["plain", ...KIT_PATTERN_STYLES];
    for (const style of styles) {
      for (const count of style === "plain" ? [1] : [1, 2]) {
        const spec: GarmentSpec =
          style === "plain" ? plain : { ...plain, kitPattern: { style, colours: KIT_COLOURS.slice(0, count), provenance: "user-edited" } };
        for (const view of VIEWS) {
          const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
          if (!model) throw new Error(`No drawing for ${garment.name}.`);
          const svg = renderSvg(withReviewNote(model, NOTE));
          const png = await sharp(Buffer.from(svg), { density: 96 }).flatten({ background: "#ffffff" }).resize({ width: PNG_WIDTH / 2 }).png().toBuffer();
          const name = `${garment.name}-${style}${style === "plain" ? "" : `-${count}`}-${view}.png`;
          writeFileSync(join(folder, name), png);
          process.stdout.write(`${name}\n`);
        }
      }
    }
  }
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT, { recursive: true });
  if (process.argv.includes("kit-styles")) return renderKitStyles();
  const families = process.argv.slice(2);
  const chosen = families.length === 0 ? VARIANTS : VARIANTS.filter((variant) => families.includes(getType(variant.typeId)?.family ?? ""));
  for (const variant of chosen) {
    const values = variant.proportionsOnly ? undefined : madeUpForType(variant.typeId, variant.choices);
    const spec = coloured(designWith(variant.typeId, variant.choices, values));
    for (const view of VIEWS) {
      const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
      if (!model) throw new Error(`No drawing for ${variant.name}.`);
      const svg = renderSvg(withReviewNote(model, variant.proportionsOnly ? PROPORTIONS_NOTE : NOTE));
      const base = join(OUTPUT, `${variant.name}-${view}`);
      writeFileSync(`${base}.svg`, svg);
      const png = await sharp(Buffer.from(svg), { density: 96 })
        .flatten({ background: "#ffffff" })
        .resize({ width: PNG_WIDTH })
        .png({ palette: true, compressionLevel: 9 })
        .toBuffer();
      writeFileSync(`${base}.png`, png);
      process.stdout.write(`${variant.name}-${view}: svg ${svg.length} bytes, png ${png.length} bytes\n`);
    }
  }
}

await main();
