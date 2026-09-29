/**
 * Writes the snapshot drawings the owner approves (owner action A6): an SVG and a PNG for
 * every tops type, front and back, into docs/owner/flats/. Run it from apps/web:
 *
 *   pnpm --filter web exec tsx scripts/render-flat-snapshots.mts
 *
 * Every drawing uses MADE-UP sizes and made-up colours, and says so in a visible line.
 * The sizes are not real garment data. They only give the drawing a realistic shape.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getType, type GarmentSpec } from "@/lib/garment";
import { buildFlat } from "@/lib/flat/build";
import { designWith, madeUpForType, typedIn } from "@/lib/flat/fixtures/designs";
import { renderSvg } from "@/lib/flat/render-svg";
import { withReviewNote } from "@/lib/flat/review-note";
import type { View } from "@/lib/flat/model";

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "owner", "flats");
const NOTE = "Made-up sizes for review of the drawing only";
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
};

interface Variant {
  readonly name: string;
  readonly typeId: string;
  readonly choices: Readonly<Record<string, string>>;
}

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
];

function coloured(spec: GarmentSpec): GarmentSpec {
  const type = getType(spec.typeId);
  const panels = new Set(type?.panels.map((panel) => panel.id));
  const colours = Object.entries(REVIEW_COLOURS)
    .filter(([panelId]) => panels.has(panelId))
    .map(([panelId, swatch]) => ({ panelId, colour: "Made-up colour", swatch, provenance: "user-edited" as const }));
  return { ...spec, colourways: [{ ...spec.colourways[0], colours }] } as GarmentSpec;
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT, { recursive: true });
  for (const variant of VARIANTS) {
    const spec = coloured(designWith(variant.typeId, variant.choices, madeUpForType(variant.typeId, variant.choices)));
    for (const view of VIEWS) {
      const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
      if (!model) throw new Error(`No drawing for ${variant.name}.`);
      const svg = renderSvg(withReviewNote(model, NOTE));
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
