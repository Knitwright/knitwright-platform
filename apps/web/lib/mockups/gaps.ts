import type { ArticleGap } from "@/lib/templates/kinds/gaps";
import { ARTICLE_FILTER_GAP } from "./library";
import { ALL_MOCKUP_SCENES, specCountGap } from "./scenes";
import { GARMENT_VIEWS, MOCKUP_GAP_RULE, type MockupScene, type SceneGap } from "./types";
import { viewGap } from "./views";

/**
 * Every gap the mockup studio has, in one place (spec decision 11: every rule explains itself; plan
 * rule: a check with no rulebook entry uses `R-GAP-000` and is listed on the pull request).
 *
 * **No rulebook entry covers the mockup studio**, so every one of these is `R-GAP-000`. Gathering
 * them here does two things: a screen can print the ones that apply to what it is showing, and the
 * pull request can list them without anybody hunting through the directory.
 *
 * An article's own gaps are never written again here. L8 already reads them out of each article's
 * own brief (`lib/templates/kinds/gaps.ts`, decision 0090); `fromArticle` only turns one into the
 * shape a card shows, and the type is imported for its shape alone so no client panel carries a
 * schema into the browser (`tests/architecture/client-weight.test.ts`).
 */

/** `07` asks each scene to name the model presets it allows. Those rows are L3's. */
export const MODEL_PRESET_GAP: SceneGap = {
  ruleId: MOCKUP_GAP_RULE,
  line: "07 asks each scene to name the model presets it allows. Those are L3's own rows (model_presets); no scene names one here, because naming one would be inventing it.",
};

/** The three-quarter and side views, and the one thing that would fix them. */
export const SERVER_RENDER_GAP: SceneGap = {
  ruleId: MOCKUP_GAP_RULE,
  line: "The platform draws the garment on the server from its flat drawing; the 3D model is turned in the browser. A true three-quarter or side render needs the 3D model drawn on the server, through the files-service seam.",
};

/** The turntable: stills here, the clip in the video studio. */
export const TURNTABLE_CLIP_GAP: SceneGap = {
  ruleId: MOCKUP_GAP_RULE,
  line: "The 360° turntable is drawn here as its still frames. The clip itself is the video studio's (F-L3, workstream L5).",
};

/**
 * The panel contract hands a panel the project, the selection, the credits and the presets
 * (`lib/launch/panels.ts`); it hands it nothing about the design behind a Design board. So a scene
 * card in the rail cannot say which base article the design is on, and cannot print that article's
 * own gaps. The board's inspector can, once the page passes them in.
 */
export const CONTEXT_ARTICLE_GAP: SceneGap = {
  ruleId: MOCKUP_GAP_RULE,
  line: "A scene card in the rail cannot name the design's base article: LaunchContext carries the project and the selection, not the design. The board's own panel shows the article's gaps instead.",
};

/**
 * The Photos panel shows two things a panel cannot reach: the brand's own uploads (L7's) and the
 * photographs of a golden sample of this design (Y7's `golden_samples`). `LaunchContext` carries
 * neither, so the panel names both doors instead of showing an empty grid and calling it a library.
 */
export const PHOTOS_GAP: SceneGap = {
  ruleId: MOCKUP_GAP_RULE,
  line: "A panel is given the project and the selection, not the brand's files. Your uploads are in the Uploads panel (L7) and a golden sample's photographs are on the design's Make page (F-S7), so this panel points at both rather than showing a library it cannot read.",
};

/** Every gap this workstream carries, for the pull request and for a test that counts them. */
export function allMockupGaps(): readonly SceneGap[] {
  const count = specCountGap();
  return [
    ...GARMENT_VIEWS.map(viewGap).filter((gap): gap is SceneGap => gap !== null),
    ARTICLE_FILTER_GAP,
    MODEL_PRESET_GAP,
    SERVER_RENDER_GAP,
    TURNTABLE_CLIP_GAP,
    CONTEXT_ARTICLE_GAP,
    PHOTOS_GAP,
    ...(count === null ? [] : [count]),
  ];
}

/** An article's own gap, in the shape a card shows. Its words and its rule are the article's. */
export const fromArticle = (gap: ArticleGap): SceneGap => ({ ruleId: gap.ruleId, line: [gap.line, ...gap.needs].join(". ") });

/**
 * The gaps that apply to one scene: the turned views it uses, the model presets for a scene a model
 * runs, and the base article's own gaps where the caller knows them.
 */
export function sceneGaps(scene: MockupScene, article: ArticleGap | null = null): readonly SceneGap[] {
  const views = [...new Set(scene.slots.map((slot) => slot.view))];
  const gaps: SceneGap[] = views.map(viewGap).filter((gap): gap is SceneGap => gap !== null);
  if (scene.source === "ai") gaps.push(MODEL_PRESET_GAP);
  if (article !== null) gaps.push(fromArticle(article));
  return gaps;
}

/** True when a scene has something it cannot show, so a card must say so instead of looking ready. */
export const hasSceneGap = (scene: MockupScene, article: ArticleGap | null = null): boolean => sceneGaps(scene, article).length > 0;

/** How many of the seeded scenes this workstream renders now, and how many are marked for L3. */
export function sceneCounts(scenes: readonly MockupScene[] = ALL_MOCKUP_SCENES): { readonly total: number; readonly deterministic: number; readonly ai: number } {
  const deterministic = scenes.filter((scene) => scene.source === "deterministic").length;
  return { total: scenes.length, deterministic, ai: scenes.length - deterministic };
}
