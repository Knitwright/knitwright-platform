import { chooseEncoder, type EncoderChoice } from "@/lib/media/video/encoder";
import { VIDEO_ASPECTS, VIDEO_FORMATS, type VideoAspect } from "@/lib/media/video/formats";
import { SEQUENCES, sequenceVerdict, type SequenceKey, type ViewCapability } from "@/lib/media/video/sequences";
import { buildableNow, findTemplate, templatePlan, VIDEO_TEMPLATES, waitingLine } from "@/lib/media/video/social-frames";
import type { RenderPlan } from "@/lib/media/video/shot-plan";
import * as copy from "./copy";
import type { AspectChoice, EmptyState } from "./panel-model";

/**
 * The deterministic side of the video studio as a value: the four free videos, the three aspects and
 * the twelve social frames, with what each one is waiting for.
 *
 * The honest part is `offered`. The 3D viewers answer one event today, which turns the garment; a
 * flip, a kit reveal and a carousel need a camera the view can point and a colourway it can swap
 * (`record-sequence.ts` asks the view what it can do). A sequence the view cannot record is shown,
 * disabled, with the sentence that says why -- never recorded as something that is not the video the
 * person asked for, and never quietly hidden.
 */

export const PHASES = ["idle", "recording", "saving", "saved", "failed"] as const;
export type Phase = (typeof PHASES)[number];

export interface SequenceCard {
  readonly key: SequenceKey;
  readonly label: string;
  readonly lead: string;
  readonly seconds: number;
  readonly offered: boolean;
  /** Why this view cannot record it, or null. */
  readonly blocked: string | null;
  readonly selected: boolean;
}

export interface TemplateCard {
  readonly key: string;
  readonly label: string;
  readonly seconds: number;
  readonly ready: boolean;
  readonly waiting: string | null;
  readonly slots: readonly Readonly<{ id: string; label: string; limit: number }>[];
  readonly selected: boolean;
}

export interface StudioView {
  readonly heading: string;
  readonly lead: string;
  readonly empty: EmptyState | null;
  readonly sequences: readonly SequenceCard[];
  readonly templates: readonly TemplateCard[];
  readonly aspects: readonly AspectChoice[];
  readonly encoder: EncoderChoice;
  /** What is happening now, in words. Null when nothing is. */
  readonly statusLine: string | null;
  readonly phase: Phase;
  /** The one sequence that would be recorded by the Record button, or null. */
  readonly recordable: SequenceKey | null;
}

export interface StudioInput {
  /** What the open 3D view says it can do. Empty means there is no view at all. */
  readonly abilities: readonly ViewCapability[];
  readonly hasView: boolean;
  readonly aspect: VideoAspect;
  readonly sequenceKey: SequenceKey;
  readonly templateKey: string | null;
  readonly phase: Phase;
  /** A sentence from the last attempt, shown as it is. */
  readonly message: string | null;
  readonly env?: Readonly<{ MEDIA_VIDEO_FFMPEG?: string | undefined }>;
}

const STATUS: Readonly<Record<Phase, string | null>> = {
  idle: null,
  recording: copy.RECORDING_PREFIX,
  saving: copy.SAVING_LINE,
  saved: copy.SAVED_LINE,
  failed: null,
};

const sequenceCards = (input: StudioInput): readonly SequenceCard[] =>
  SEQUENCES.map((sequence) => {
    const verdict = sequenceVerdict(sequence, input.abilities);
    return {
      key: sequence.key,
      label: sequence.label,
      lead: sequence.lead,
      seconds: sequence.seconds,
      offered: verdict.offered,
      blocked: verdict.offered ? null : verdict.reason,
      selected: input.sequenceKey === sequence.key,
    };
  });

const templateCards = (input: StudioInput): readonly TemplateCard[] =>
  VIDEO_TEMPLATES.map((template) => ({
    key: template.key,
    label: template.label,
    seconds: template.seconds,
    ready: buildableNow(template),
    waiting: waitingLine(template),
    slots: template.slots.map((slot) => ({ id: slot.id, label: slot.label, limit: slot.limit })),
    selected: input.templateKey === template.key,
  }));

/** Everything the deterministic studio draws. Pure, so its states are read without a browser. */
export function studioView(input: StudioInput): StudioView {
  const sequences = sequenceCards(input);
  const chosen = sequences.find((card) => card.selected) ?? null;
  return {
    heading: copy.STUDIO_HEADING,
    lead: copy.STUDIO_LEAD,
    empty: input.hasView ? null : copy.STUDIO_EMPTY,
    sequences,
    templates: templateCards(input),
    aspects: VIDEO_ASPECTS.map((aspect) => ({ aspect, label: VIDEO_FORMATS[aspect].label, selected: input.aspect === aspect })),
    encoder: chooseEncoder(input.env ?? {}),
    statusLine: input.message ?? STATUS[input.phase],
    phase: input.phase,
    recordable: chosen?.offered ? chosen.key : null,
  };
}

/**
 * The plan the Record button would play: the chosen social frame's own sequence with the typed text
 * burned in, or the chosen sequence on its own. Null when nothing can be recorded here.
 */
export function studioPlan(
  input: StudioInput,
  text: Readonly<Record<string, string>> = {},
  sampleFrames?: number,
): RenderPlan | null {
  const template = findTemplate(input.templateKey);
  if (template) return templatePlan({ template, aspect: input.aspect, text, ...(sampleFrames === undefined ? {} : { sampleFrames }) });
  const view = studioView(input);
  if (view.recordable === null) return null;
  const made = findTemplate(view.recordable);
  return made ? templatePlan({ template: made, aspect: input.aspect, text, ...(sampleFrames === undefined ? {} : { sampleFrames }) }) : null;
}
