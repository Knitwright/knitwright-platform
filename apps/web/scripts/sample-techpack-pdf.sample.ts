/**
 * Writes a sample tech pack PDF and Excel file, for a look at the layout: a polo with a few
 * measurements typed in for the base size, five sizes and no size chart. The numbers are
 * MADE UP for the sample only and are not measurements of any garment. Run it from apps/web:
 *
 *   pnpm --filter web exec tsx scripts/sample-techpack-pdf.mts <output folder>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildTechPack } from "@/lib/techpack/build";
import { flatsForTechPack } from "@/lib/techpack/flats";
import { buildPdf } from "@/lib/techpack/exports/pdf/document";
import { buildWorkbook } from "@/lib/techpack/exports/excel/workbook";

const output = process.env.SAMPLE_OUT;
if (!output) throw new Error("Name an output folder.");

const steps: readonly SpecAction[] = [
  { type: "set-sizing", sizing: { sizes: ["XS", "S", "M", "L", "XL"], baseSize: "M" } },
  { type: "set-measurement", pointId: "chest-width", value: 5200, provenance: "user-edited" },
  { type: "set-measurement", pointId: "body-length", value: 7000, provenance: "user-edited" },
  { type: "set-measurement", pointId: "sleeve-length", value: 2200, provenance: "user-edited" },
];
const spec = steps.reduce<GarmentSpec>((current, step) => {
  const result = applyAction(current, step);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
}, start("polo"));

const pack = buildTechPack({
  project: { name: "Club polo", styleNumber: "KW-001", season: "SS27", brandName: "Sample Brand" },
  version: 2,
  versionDate: "12 Oct 2026",
  versionDateIso: "2026-10-12",
  printedOn: "13 Oct 2026",
  printedOnIso: "2026-10-13",
  history: [
    { version: 2, date: "12 Oct 2026", dateIso: "2026-10-12", note: "Measurements added.", by: "Sam Sample" },
    { version: 1, date: "10 Oct 2026", dateIso: "2026-10-10", note: "First version.", by: null },
  ],
  spec,
  flats: flatsForTechPack(spec),
});

mkdirSync(output, { recursive: true });
writeFileSync(join(output, "sample-polo.pdf"), await buildPdf(pack, new Map()));
writeFileSync(join(output, "sample-polo.xlsx"), await buildWorkbook(pack));
process.stdout.write(`Wrote ${join(output, "sample-polo.pdf")}\n`);
