import { VIDEO_GAP_RULE, type VideoAspect } from "./formats";
import { videoSequence, type SequenceKey } from "./sequences";
import { buildRenderPlan, type RenderPlan, type TextOverlay, type TextRole } from "./shot-plan";

/**
 * THE TWELVE VIDEO TEMPLATES of `docs/spec/07-template-library.md`, as rows, with the text slots that
 * are burned into the picture (spec F-L3: "Video templates place a clip under text, logo and a QR or
 * link chip. Export as MP4 with the text burned in").
 *
 * Each row carries the length and the source `07` gives it, never a number this file chose. Four of
 * the twelve are built from a deterministic sequence and work now; two are made on an AI video board
 * and then have their text burned in; the other six need a source another workstream owns -- a
 * marketing artboard (L4), the size chart and the feature callouts of an info card (L6), the brand's
 * logo sting (L7) -- and each of those says plainly what it is waiting for rather than looking ready.
 *
 * These rows are **not** `templates` table rows of kind `video`. `templates` is read by
 * `lib/templates/service.ts`, which parses every row against the design shape, so seeding video rows
 * means narrowing `loadLibrary` to `kind = 'design'` in the same change (the note L1 left in
 * `panels.ts`), and that file belongs to L8. The rows are here, in the shape a seed would take, and
 * the pull request says so.
 */

export const TEMPLATE_SOURCES = ["three_d", "renders", "ai_clip", "marketing", "brand_kit", "size_chart", "techpack"] as const;
export type TemplateSource = (typeof TEMPLATE_SOURCES)[number];

export interface TextSlot {
  readonly id: string;
  /** The label on the field. */
  readonly label: string;
  /** The most characters this slot takes (spec `07`: "text fields with a character limit"). */
  readonly limit: number;
  readonly role: TextRole;
  readonly xPercent: number;
  readonly yPercent: number;
  readonly align: "left" | "centre" | "right";
  readonly sizePercent: number;
  /** When the text comes in and goes out, as shares of the whole length. */
  readonly fromPart: number;
  readonly toPart: number;
}

export interface VideoTemplate {
  readonly key: string;
  readonly label: string;
  /** The length `07` gives this template. */
  readonly seconds: number;
  readonly source: TemplateSource;
  /** The deterministic sequence it is built from, or null. */
  readonly sequenceKey: SequenceKey | null;
  readonly slots: readonly TextSlot[];
  /** What this template is waiting for, or null when it can be made now. */
  readonly waitingOn: string | null;
  readonly ruleId: string;
  readonly note: string;
}

const NOTE = "Length and source from the video templates table of docs/spec/07-template-library.md";

const slot = (id: string, label: string, limit: number, role: TextRole, over: Partial<TextSlot> = {}): TextSlot => ({
  id,
  label,
  limit,
  role,
  xPercent: 50,
  yPercent: role === "headline" ? 12 : role === "subhead" ? 22 : 88,
  align: "centre",
  sizePercent: role === "headline" ? 7 : role === "subhead" ? 4.5 : 3.5,
  fromPart: 0,
  toPart: 1,
  ...over,
});

const HEADLINE = slot("headline", "Headline", 40, "headline");
const SUBHEAD = slot("subhead", "Second line", 60, "subhead");
const CHIP = slot("chip", "Link or QR chip", 30, "chip");

const row = (
  key: string,
  label: string,
  seconds: number,
  source: TemplateSource,
  sequenceKey: SequenceKey | null,
  slots: readonly TextSlot[],
  waitingOn: string | null = null,
): VideoTemplate => ({ key, label, seconds, source, sequenceKey, slots, waitingOn, ruleId: VIDEO_GAP_RULE, note: NOTE });

const WAITING_MARKETING = "the marketing studio's artboards (workstream L4)";
const WAITING_INFO_CARD = "the info card's size chart and callouts (workstream L6)";
const WAITING_BRAND = "the brand's own logo and type (workstream L7)";

export const VIDEO_TEMPLATES: readonly VideoTemplate[] = [
  row("turntable", "360° kit turntable", 6, "three_d", "turntable", [HEADLINE, CHIP]),
  row("flip", "Front-to-back flip", 4, "three_d", "flip", [HEADLINE]),
  row("kit_reveal", "Kit reveal", 8, "three_d", "kit_reveal", [HEADLINE, SUBHEAD, CHIP]),
  row("carousel", "Home / away / GK carousel", 9, "renders", "carousel", [
    slot("headline", "Headline", 40, "headline"),
    slot("home", "First kit", 20, "subhead", { fromPart: 0, toPart: 1 / 3 }),
    slot("away", "Second kit", 20, "subhead", { fromPart: 1 / 3, toPart: 2 / 3 }),
    slot("gk", "Third kit", 20, "subhead", { fromPart: 2 / 3, toPart: 1 }),
  ]),
  row("countdown", "Launch countdown", 10, "marketing", null, [HEADLINE, SUBHEAD, CHIP], WAITING_MARKETING),
  row("walk_out", "Player walk-out", 5, "ai_clip", null, [HEADLINE, CHIP], "a clip from an AI video board, which is where it is made"),
  row("training", "Training clip", 5, "ai_clip", null, [HEADLINE], "a clip from an AI video board, which is where it is made"),
  row("drop_teaser", "Drop teaser with logo sting", 6, "brand_kit", null, [HEADLINE, CHIP], WAITING_BRAND),
  row("size_guide", "Size guide explainer", 10, "size_chart", null, [HEADLINE, SUBHEAD], WAITING_INFO_CARD),
  row("feature_callouts", "Feature callouts", 8, "techpack", null, [HEADLINE, SUBHEAD], WAITING_INFO_CARD),
  row("order_now", 'Team store "order now"', 6, "marketing", null, [HEADLINE, SUBHEAD, CHIP], WAITING_MARKETING),
  row("product_carousel", "Product carousel for Shopify", 12, "renders", null, [HEADLINE], WAITING_MARKETING),
];

export const findTemplate = (key: unknown): VideoTemplate | null =>
  (typeof key === "string" ? VIDEO_TEMPLATES.find((template) => template.key === key) : undefined) ?? null;

/** True when this template can be made now: it is built from a sequence the platform draws itself. */
export const buildableNow = (template: VideoTemplate): boolean => template.sequenceKey !== null && template.waitingOn === null;

/** The words for a template that cannot be made yet. Never a sentence that pretends it can. */
export const waitingLine = (template: VideoTemplate): string | null =>
  template.waitingOn === null ? null : `This template needs ${template.waitingOn}, so it cannot be made here yet.`;

export type SlotVerdict = Readonly<{ ok: true; text: string }> | Readonly<{ ok: false; reason: string; ruleId: string }>;

/** Whether this text fits the slot. A refusal names the limit, so the person can read what to cut. */
export function slotVerdict(slot: TextSlot, text: string): SlotVerdict {
  const given = text.trim();
  if (given.length > slot.limit) {
    return { ok: false, reason: `${slot.label} takes ${slot.limit} characters. That is ${given.length}.`, ruleId: VIDEO_GAP_RULE };
  }
  return { ok: true, text: given };
}

/** A slot and its text as an overlay on a video of this length. Text that does not fit is left out. */
function overlayOf(slot: TextSlot, text: string, durationMs: number): readonly TextOverlay[] {
  const verdict = slotVerdict(slot, text);
  if (!verdict.ok || verdict.text === "") return [];
  return [
    {
      id: slot.id,
      text: verdict.text,
      fromMs: Math.round(slot.fromPart * durationMs),
      toMs: Math.round(slot.toPart * durationMs),
      xPercent: slot.xPercent,
      yPercent: slot.yPercent,
      align: slot.align,
      sizePercent: slot.sizePercent,
      role: slot.role,
    },
  ];
}

export interface TemplatePlanInput {
  readonly template: VideoTemplate;
  readonly aspect: VideoAspect;
  /** What the person typed, by slot id. A slot with nothing in it draws nothing. */
  readonly text: Readonly<Record<string, string>>;
  readonly sampleFrames?: number;
}

/**
 * The plan for a social frame: the template's own sequence with the text burned in. Null for a
 * template whose source does not exist yet -- a plan that drew nothing would be a lie about it.
 */
export function templatePlan(input: TemplatePlanInput): RenderPlan | null {
  const sequence = videoSequence(input.template.sequenceKey);
  if (!sequence || !buildableNow(input.template)) return null;
  const durationMs = sequence.seconds * 1000;
  const overlays = input.template.slots.flatMap((slot) => overlayOf(slot, input.text[slot.id] ?? "", durationMs));
  return buildRenderPlan({
    sequence,
    aspect: input.aspect,
    overlays,
    ...(input.sampleFrames === undefined ? {} : { sampleFrames: input.sampleFrames }),
  });
}
