import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { devArticles, devSource } from "@/lib/products/fixtures/dev";
import type { ValidationCheck } from "@/lib/validation/check";
import { garmentInspector } from "../garment";
import { garmentNamesNumbers } from "../garment";
import type { GarmentInspectorView } from "../types";

/**
 * FIXTURE ONLY: the garment `/dev/inspector` draws (decision 0147), for the 1440 × 900 comparison with
 * e15 and e22–e25, e41. The base article and its price tiers are the real launch catalogue's JSY-SS-01
 * with the build pack's placeholder ladder (`lib/products/fixtures/dev.ts`); the design, its crest,
 * its sponsor picture, its hoops and its checks are made up and say so.
 */

export const DEV_DESIGN = "00000000-0000-4000-8000-0000000000d1";
const PICTURE = "00000000-0000-4000-8000-0000000000f1";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  return result.ok ? result.spec : spec;
};

const check = (code: string, passed: boolean, message: string, severity: "blocker" | "warning" | null = null): ValidationCheck => ({
  code,
  severity: passed ? null : severity,
  message,
  target: { article: null, panel: passed ? null : "body-front" },
  ruleId: "R-GAP-000",
  passed,
});

const CHECKS: readonly ValidationCheck[] = [
  check("artwork-resolution", true, "Nothing found."),
  check("safe-zones", true, "Nothing found."),
  check("seam-crossing", false, "Made-up finding: the sponsor crosses the side seam.", "warning"),
  check("print-safe-colours", true, "Nothing found."),
  check("parameters-in-range", true, "Nothing found."),
  check("moderation", true, "Nothing found."),
  check("names-numbers-zones", true, "Nothing found."),
];

export function devGarmentView(): GarmentInspectorView {
  const article = devArticles().find((one) => one.code === "JSY-SS-01")!;
  const first = start(article.registryTypeId ?? "crew-tee", "men");
  const actions: readonly SpecAction[] = [
    { type: "set-article", article: { baseArticleCode: article.code, productionClass: article.productionClass, parameters: {} } },
    {
      type: "update-colourway",
      colourway: {
        id: first.colourways[0].id,
        name: "Home",
        colours: [
          { panelId: "body-front", colour: "Navy", swatch: "#0b1f4b", provenance: "user-edited" },
          { panelId: "body-back", colour: "Navy", swatch: "#0b1f4b", provenance: "user-edited" },
        ],
      },
    },
    { type: "set-kit-pattern", kitPattern: { style: "pinstripes", colours: [{ colour: "Gold", swatch: "#f2b705" }], provenance: "user-edited" } },
    {
      type: "add-artwork",
      artwork: { id: "crest", name: "LL crest", source: { kind: "text", text: "LL" }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 800, height: 900, rotationDegrees: 0, technique: "sublimation", provenance: "user-edited" },
    },
    {
      type: "add-artwork",
      artwork: { id: "sponsor", name: "Sialkot Tyres sponsor", source: { kind: "file", fileId: PICTURE }, panelId: "body-front", anchor: "centre-chest", offsetX: 0, offsetY: 0, width: 2400, height: 600, rotationDegrees: 0, technique: "sublimation", provenance: "user-edited" },
    },
  ];
  let spec = actions.reduce(apply, first);
  const marks = garmentNamesNumbers(spec).turnOn;
  if (marks) spec = apply(spec, marks as SpecAction);
  return garmentInspector({
    designId: DEV_DESIGN,
    name: "Home kit v7",
    version: 7,
    spec,
    article,
    checks: CHECKS,
    price: devSource(article.code),
    currency: "GBP",
    factory: { name: "Knitwright Sialkot (placeholder)", leadTimeDays: 8 },
  });
}
