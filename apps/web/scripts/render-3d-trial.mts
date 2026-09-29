/**
 * Writes the pictures of the 3D trial (step 9A task 1) that the owner judges (owner action
 * A10) into docs/owner/3d/. Run it from apps/web:
 *
 *   pnpm --filter web exec tsx scripts/render-3d-trial.mts
 *
 * It draws the crew tee with the real form builder (lib/garment3d) and the real three.js
 * scene (components/garment3d/scene.ts) in headless Chrome, from a page it writes itself.
 * No app server is started. The sizes and colours are MADE UP, only to give the form a
 * realistic shape, and each picture says so.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { getType, type GarmentSpec } from "@/lib/garment";
import { buildFlat } from "@/lib/flat/build";
import { designWith, madeUpForType, typedIn } from "@/lib/flat/fixtures/designs";
import type { FlatModel, View } from "@/lib/flat/model";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { shapeSource } from "@/lib/garment3d/shape";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const OUTPUT = join(WEB, "..", "..", "docs", "owner", "3d");
const NOTE = "Trial 3D form. Made-up sizes and colours. A preview of shape and colour, not of fit or drape.";
const SIZE = 900;

interface Look {
  readonly name: string;
  readonly colours: Readonly<Record<string, string>>;
}

/** Made-up colours, so the owner can see colour carried from the flat. They are not a colour scheme. */
const LOOKS: readonly Look[] = [
  { name: "light", colours: { "body-front": "#dbe4f0", "body-back": "#dbe4f0", "sleeve-left": "#dbe4f0", "sleeve-right": "#dbe4f0", neckband: "#1b2a49" } },
  { name: "red", colours: { "body-front": "#b3262e", "body-back": "#b3262e", "sleeve-left": "#f2f2f2", "sleeve-right": "#f2f2f2", neckband: "#f2f2f2" } },
];

function coloured(spec: GarmentSpec, look: Look): GarmentSpec {
  const panels = new Set(getType(spec.typeId)?.panels.map((panel) => panel.id));
  const colours = Object.entries(look.colours)
    .filter(([panelId]) => panels.has(panelId))
    .map(([panelId, swatch]) => ({ panelId, colour: "Made-up colour", swatch, provenance: "user-edited" as const }));
  return { ...spec, colourways: [{ ...spec.colourways[0], colours }] } as GarmentSpec;
}

function flats(look: Look): Record<View, FlatModel> {
  const spec = coloured(designWith("crew-tee", {}, madeUpForType("crew-tee", {})), look);
  const draw = (view: View) => {
    const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
    if (!model) throw new Error("No drawing for the crew tee.");
    return model;
  };
  return { front: draw("front"), back: draw("back") };
}

/** The part of esbuild used here. It is not a direct dependency: tsx brings it. */
interface Bundler {
  build(options: Record<string, unknown>): Promise<{ outputFiles: readonly { text: string }[] }>;
}

/** Bundles the real scene code for the page, with the esbuild that tsx already brings. */
async function bundle(): Promise<string> {
  const esbuild = createRequire(createRequire(import.meta.url).resolve("tsx"))("esbuild") as Bundler;
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { buildGarmentMesh } from "@/lib/garment3d/mesh";
        import { mountGarment, paintFlat } from "@/components/garment3d/scene";
        window.showGarment = async (input) => {
          const mesh = buildGarmentMesh(input.shape);
          const [front, back] = await Promise.all([paintFlat(input.front, input.shape.front.bounds), paintFlat(input.back, input.shape.back.bounds)]);
          window.garment = mountGarment(document.querySelector("canvas"), mesh, { front, back }, { autoRotate: false, easeSeconds: 0 });
          return mesh.size;
        };`,
      resolveDir: WEB,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
    alias: { "@": WEB },
    logLevel: "silent",
  });
  return result.outputFiles[0]?.text ?? "";
}

const page = (script: string): string => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #f6f7f9; font: 15px Arial, sans-serif; color: #1b2a49; }
  canvas { display: block; width: ${SIZE}px; height: ${SIZE}px; background: #ffffff; }
  p { position: absolute; left: 16px; bottom: 8px; margin: 0; }
</style></head><body><canvas></canvas><p>${NOTE}</p><script>${script}</script></body></html>`;

async function drag(target: Page, dx: number, dy: number): Promise<void> {
  const middle = SIZE / 2;
  await target.mouse.move(middle, middle);
  await target.mouse.down();
  await target.mouse.move(middle + dx, middle + dy, { steps: 12 });
  await target.mouse.up();
}

/** A drag of this many pixels turns the form by this many degrees (three.js OrbitControls: a full turn per canvas height). */
const pixelsFor = (degrees: number): number => (SIZE * degrees) / 360;

async function shoot(target: Page, file: string): Promise<void> {
  await target.waitForTimeout(400);
  await target.screenshot({ path: join(OUTPUT, file), clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
  process.stdout.write(`${file}\n`);
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT, { recursive: true });
  const script = await bundle();
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const look of LOOKS) {
      const models = flats(look);
      const tab = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
      tab.on("pageerror", (error) => process.stderr.write(`page error: ${error.message}\n`));
      await tab.setContent(page(script));
      const size = await tab.evaluate(
        (input) => (window as unknown as { showGarment: (value: unknown) => Promise<unknown> }).showGarment(input),
        {
          shape: { front: shapeSource(models.front), back: shapeSource(models.back) },
          front: svgDataUri(renderSvg(models.front)),
          back: svgDataUri(renderSvg(models.back)),
        },
      );
      process.stdout.write(`${look.name}: size in metres ${JSON.stringify(size)}\n`);
      await shoot(tab, `crew-tee-${look.name}-front.png`);
      await drag(tab, pixelsFor(-35), pixelsFor(-12));
      await shoot(tab, `crew-tee-${look.name}-three-quarter.png`);
      await drag(tab, pixelsFor(-55), 0);
      await shoot(tab, `crew-tee-${look.name}-side.png`);
      await tab.evaluate(() => (window as unknown as { garment: { showSide: (view: string) => void } }).garment.showSide("back"));
      await shoot(tab, `crew-tee-${look.name}-back.png`);
      await tab.close();
    }
  } finally {
    await browser.close();
  }
}

await main();
