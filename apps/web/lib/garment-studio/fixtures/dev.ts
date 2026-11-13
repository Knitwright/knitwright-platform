import type { BaseArticle } from "@/lib/catalogue";
import { editorPageState, type EditorPageState } from "@/lib/editor/page-state";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { devArticles } from "@/lib/products/fixtures/dev";
import { buildEditorData, type EditorData } from "@/lib/projects/editor-data";
import type { OpenProject } from "@/lib/projects/project-reads";
import type { ValidationCheck } from "@/lib/validation/check";
import { PALETTE_RULE_ID } from "@/lib/panel-layers/palettes";
import type { ClubLibrary } from "../library";

/**
 * FIXTURE ONLY: the design `/dev/garment-studio` draws (decision 0150), for the 1440 × 900 comparison
 * with s01–s07 and s16–s19. The base article is the real launch catalogue's JSY-SS-01; the design, its
 * club, its colours and its checks are made up and say so.
 */

export const DEV_STUDIO_DESIGN = "00000000-0000-4000-8000-0000000000e1";

const apply = (spec: GarmentSpec, action: SpecAction): GarmentSpec => {
  const result = applyAction(spec, action);
  return result.ok ? result.spec : spec;
};

const colour = (panelId: string, name: string, swatch: string) => ({ panelId, colour: name, swatch, provenance: "user-edited" as const });

function devSpec(article: BaseArticle): GarmentSpec {
  const first = start(article.registryTypeId ?? "crew-tee", "men");
  const actions: readonly SpecAction[] = [
    { type: "set-article", article: { baseArticleCode: article.code, productionClass: article.productionClass, parameters: {} } },
    {
      type: "update-colourway",
      colourway: { id: first.colourways[0].id, name: "Home", colours: [colour("body-front", "Navy", "#0b1f4b"), colour("body-back", "Navy", "#0b1f4b")] },
    },
    { type: "add-colourway", colourway: { id: "away", name: "Away", colours: [colour("body-front", "White", "#ffffff")] } },
    { type: "add-colourway", colourway: { id: "gk", name: "Goalkeeper", colours: [colour("body-front", "Green", "#1e8a3a")] } },
    {
      type: "add-artwork",
      artwork: { id: "crest", name: "Crest", source: { kind: "text", text: "LL" }, panelId: "body-front", anchor: "left-chest", offsetX: 0, offsetY: 0, width: 800, height: 900, rotationDegrees: 0, technique: "sublimation", provenance: "user-edited" },
    },
  ];
  return actions.reduce(apply, first);
}

const CHECKS: readonly ValidationCheck[] = [
  { code: "parameters-in-range", severity: null, message: "Nothing found.", target: { article: null, panel: null }, ruleId: "R-GAP-000", passed: true },
];

export interface DevStudio {
  readonly article: BaseArticle;
  readonly data: EditorData;
  readonly state: EditorPageState;
  readonly checks: readonly ValidationCheck[];
  readonly club: ClubLibrary;
}

const swatch = (id: string, label: string, hex: string) => ({
  id: `brand-${id}`,
  kind: "colour" as const,
  label,
  code: null,
  swatch: hex,
  card: [{ label: "Screen colour", value: hex }],
  ruleId: PALETTE_RULE_ID,
  apply: { kind: "colour" as const, colour: "", swatch: hex },
});

/** A made-up club, so the studio's own-library panels have something to draw. */
export const DEV_CLUB: ClubLibrary = {
  name: "Lahore Lions FC (made up)",
  palettes: [{ id: "club", name: "Club colours", colours: [swatch("navy", "Navy", "#0b1f4b"), swatch("gold", "Gold", "#f2b705"), swatch("white", "White", "#ffffff")] }],
  uploads: [{ id: "crest", label: "Lions crest", kind: "crest" }],
};

/** The fixture studio for an address's query (`?shelf=`, `?view=`), the way the page reads it. */
export function devStudio(query: Readonly<Record<string, string | string[] | undefined>>): DevStudio {
  const article = devArticles().find((one) => one.code === "JSY-SS-01") as BaseArticle;
  const spec = devSpec(article);
  const project: OpenProject = {
    id: DEV_STUDIO_DESIGN,
    name: "Home kit v7",
    styleNumber: "LL-H-07",
    season: "SS27",
    garmentType: spec.typeId,
    garmentLabel: "Team jersey",
    currentVersion: 7,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-12T10:00:00Z",
    versionSavedAt: "2026-11-12T10:00:00Z",
    spec,
    dropped: [],
  };
  const data = buildEditorData(project, { versions: [], hasMore: false });
  return { article, data, state: editorPageState({ query, article, sizing: spec.sizing }), checks: CHECKS, club: DEV_CLUB };
}
