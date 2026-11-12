import { aspectOf, presetSize, type ArtboardPreset, type BoardKind, type Size } from "@/lib/launch";
import { layoutsFor } from "@/lib/marketing/campaign/generate";
import { EMPTY_FORM } from "@/lib/marketing/campaign/form";
import type { Campaign, CampaignStyle, Destination } from "@/lib/marketing/campaign/steps";
import { buildLayouts } from "@/lib/marketing/templates/plans";
import type { MarketingLayout } from "@/lib/marketing/templates/types";
import { writeBoardSettings as writeVideoSettings, DEFAULT_SETTINGS as VIDEO_DEFAULTS } from "@/lib/media/video/ai-board";
import { isPresetKey } from "@/lib/media/video/prompt-presets";
import { DEFAULT_SETTINGS as SHOOT_DEFAULTS, settingsOfConcept, writeBoardSettings as writeShootSettings } from "@/lib/shoots/board";
import { conceptBySlug } from "@/lib/shoots/concepts";
import type { ShootAspect } from "@/lib/shoots/types";
import type { Answers } from "./answers";
import { SURFACES, TEAM_LAYOUTS } from "./forms";

/**
 * WHAT A CANVAS WORKFLOW PUTS ON A LAUNCH CANVAS (decision 0141).
 *
 * A workflow page does not run boards itself. It sets a launch canvas up from the form -- a Design
 * board for the chosen product and the boards that make the output, connected -- and opens it, where
 * every board runs through the run engine with its cost shown before anything is spent, and the
 * garment lock is checked (decision 0133). So a workflow can only make what a person could make on
 * the canvas by hand, and never a picture of the garment a model drew.
 *
 * Pure: it writes nothing. Where a flow template already is the workflow (`07`), the plan names it
 * and `applyFlowTemplate` lays it out, so the two can never drift.
 */

export interface PlannedBoard {
  readonly key: string;
  readonly kind: BoardKind;
  readonly name: string;
  readonly size: Size;
  readonly settings: Readonly<Record<string, unknown>>;
  /** The boards that feed this one, by key, in input order. */
  readonly feeds: readonly string[];
}

export type CanvasPlan = Readonly<{ template: string }> | Readonly<{ boards: readonly PlannedBoard[] }>;

const SQUARE: Size = { width: 1080, height: 1080 };
const DESIGN: PlannedBoard = { key: "design", kind: "design", name: "Your design", size: SQUARE, settings: {}, feeds: [] };

const mockup = (key: string, name: string, scene: string, size: Size = SQUARE): PlannedBoard => ({
  key,
  kind: "mockup",
  name,
  size,
  settings: { scene, aspect: aspectOf(size) },
  feeds: ["design"],
});

const sizeOf = (presets: readonly ArtboardPreset[], key: string): Size => {
  const found = presets.find((one) => one.key === key);
  return found ? presetSize(found) : SQUARE;
};

const textSlot = (layout: MarketingLayout, style: "headline" | "subheadline" | "body"): string | null =>
  layout.slots.find((slot) => slot.kind === "text" && slot.style === style)?.id ?? null;

/** A marketing board on one layout, at a format it comes in, with the person's words in its slots. */
function marketingBoard(layout: MarketingLayout, format: string, words: Readonly<Record<string, string>>, presets: readonly ArtboardPreset[], feeds: readonly string[]): PlannedBoard {
  const at = (layout.formats as readonly string[]).includes(format) ? format : (layout.formats[0] ?? format);
  const filled: Record<string, string> = {};
  for (const [style, value] of Object.entries(words)) {
    const slot = textSlot(layout, style as "headline" | "body");
    if (slot !== null && value !== "") filled[slot] = value;
  }
  return {
    key: `post-${layout.key}`,
    kind: "marketing",
    name: layout.title,
    size: sizeOf(presets, at),
    settings: { templateSlug: `${layout.key}-${at}`, layoutKey: layout.key, format: at, words: filled },
    feeds,
  };
}

const layoutByKey = (key: string): MarketingLayout | null => buildLayouts().find((one) => one.key === key) ?? null;

const tryOn = (answers: Answers, count: number): readonly PlannedBoard[] => {
  const concept = conceptBySlug(answers.scene ?? "");
  const base = concept ? settingsOfConcept(concept) : SHOOT_DEFAULTS;
  const settings = { ...base, modelSource: "preset" as const, modelPresetKey: answers.model ?? null, poseKey: answers.pose ?? base.poseKey, aspect: (answers.format ?? "1:1") as ShootAspect, count };
  return [DESIGN, { key: "shot", kind: "ai_image", name: "On-model try-on", size: SQUARE, settings: writeShootSettings(settings), feeds: ["design"] }];
};

const flatLay = (answers: Answers, count: number): readonly PlannedBoard[] => {
  const surface = SURFACES.find((one) => one.value === answers.surface)?.label ?? "White";
  const settings = {
    ...SHOOT_DEFAULTS,
    style: "clean-ecom" as const,
    aspect: (answers.format ?? "1:1") as ShootAspect,
    count,
    backgroundSource: "text" as const,
    backgroundText: `${surface} surface, seen from directly above`,
    prompt: "The kit laid flat, top-down, nothing on top of it.",
  };
  return [DESIGN, mockup("flat", "Flat lay", "flat-lay"), { key: "shot", kind: "ai_image", name: "Flat-lay studio", size: SQUARE, settings: writeShootSettings(settings), feeds: ["flat"] }];
};

const tryOnVideo = (answers: Answers): readonly PlannedBoard[] => {
  const presetKey = isPresetKey(answers.setting) ? answers.setting : null;
  const settings = { ...VIDEO_DEFAULTS, modelKey: answers.model ?? null, presetKey, seconds: 6 };
  return [DESIGN, mockup("frame", "First frame", "render-front"), { key: "clip", kind: "ai_video", name: "Try-on video", size: { width: 1080, height: 1920 }, settings: writeVideoSettings(settings), feeds: ["frame"] }];
};

const launchAd = (answers: Answers, count: number, presets: readonly ArtboardPreset[]): readonly PlannedBoard[] => {
  const form = { ...EMPTY_FORM, campaign: answers.campaign as Campaign, style: answers.style as CampaignStyle, destination: answers.destination as Destination, highlight: answers.highlight ?? "" };
  const posts = layoutsFor({ ...form, product: { source: "design", id: "design", name: "design" }, imageCount: count })
    .slice(0, count)
    .map((layout) => marketingBoard(layout, form.destination, { headline: form.highlight }, presets, ["hanger"]));
  return [DESIGN, mockup("hanger", "Kit on a hanger", "hanger"), ...posts];
};

const storePromo = (answers: Answers, presets: readonly ArtboardPreset[]): readonly PlannedBoard[] => {
  const closes = answers.deadline ? new Date(`${answers.deadline}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
  const posts = (["order-your-kit", "size-reminder", "last-chance"] as const).flatMap((key) => {
    const layout = layoutByKey(key);
    return layout ? [marketingBoard(layout, answers.destination ?? "", { headline: `Order by ${closes}` }, presets, ["hanger"])] : [];
  });
  return [DESIGN, mockup("hanger", "Kit on a hanger", "hanger"), ...posts];
};

const teamPost = (workflowId: string, answers: Answers, presets: readonly ArtboardPreset[]): readonly PlannedBoard[] => {
  const team = TEAM_LAYOUTS[workflowId];
  const layout = team ? layoutByKey(team.layout) : null;
  if (!team || !layout) return [DESIGN];
  const words = { headline: answers.headline ?? "", body: answers.body ?? "" };
  return [DESIGN, mockup("render", "Front render", "render-front"), marketingBoard(layout, answers.format ?? "", words, presets, ["render"])];
};

/** One mockup per screen size a platform admin keeps, so the design is drawn again at each shape. */
const resize = (presets: readonly ArtboardPreset[]): readonly PlannedBoard[] => [
  DESIGN,
  ...presets.filter((one) => one.unit === "px").map((one) => mockup(`size-${one.key}`, one.label, "render-front", presetSize(one))),
];

/** The canvas a workflow sets up from its answers, or null for a workflow that is not a canvas one. */
export function planCanvas(workflowId: string, answers: Answers, count: number, presets: readonly ArtboardPreset[]): CanvasPlan | null {
  switch (workflowId) {
    case "colourway-set":
      return { template: "colourway-set" };
    case "shopify-listing-set":
      return { template: "shopify-product-listing" };
    case "on-model-try-on":
      return { boards: tryOn(answers, count) };
    case "flat-lay-studio":
      return { boards: flatLay(answers, count) };
    case "try-on-video":
      return { boards: tryOnVideo(answers) };
    case "kit-launch-ad":
      return { boards: launchAd(answers, count, presets) };
    case "team-store-promo":
      return { boards: storePromo(answers, presets) };
    case "resize-for-all-socials":
      return { boards: resize(presets) };
    default:
      return TEAM_LAYOUTS[workflowId] ? { boards: teamPost(workflowId, answers, presets) } : null;
  }
}

/** Where each board lands: the Design board on the left, then a column per step away from it. */
export function placeBoards(boards: readonly PlannedBoard[]): readonly Readonly<{ key: string; x: number; y: number }>[] {
  const depth = new Map<string, number>();
  const depthOf = (board: PlannedBoard): number => {
    const known = depth.get(board.key);
    if (known !== undefined) return known;
    const parents = board.feeds.map((key) => boards.find((one) => one.key === key)).filter((one): one is PlannedBoard => one !== undefined);
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(depthOf));
    depth.set(board.key, value);
    return value;
  };
  const nextY = new Map<number, number>();
  return boards.map((board) => {
    const column = depthOf(board);
    const y = nextY.get(column) ?? 0;
    nextY.set(column, y + board.size.height + 160);
    return { key: board.key, x: column * 1600, y };
  });
}
