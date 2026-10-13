import { WEARERS, getType, type Wearer } from "@/lib/garment";
import { findMentions } from "@/lib/intent/mentions";
import type { LengthUnit } from "@/lib/units/length";

/**
 * The guided flow (plan step 15): one path from a sentence, a sketch or a garment picker to
 * the files a factory needs, and on to a committee and a quote. Start, review, adjust, download,
 * then share and get it made. Everything the screens decide is here; the components hold
 * markup and wiring.
 */

export const STEP_IDS = ["start", "review", "adjust", "download", "make"] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface GuidedStep {
  readonly id: StepId;
  readonly label: string;
  /** One sentence on what happens in the step. */
  readonly hint: string;
}

export const GUIDED_STEPS: readonly GuidedStep[] = [
  { id: "start", label: "Start", hint: "Say what you want to make, or show a sketch or photo." },
  { id: "review", label: "Review", hint: "Check the drawing and the measurements the design has now." },
  { id: "adjust", label: "Adjust", hint: "Change any option, or ask for a change in your own words." },
  { id: "download", label: "Download", hint: "Get the factory file as a PDF and a spreadsheet, and the drawings." },
  { id: "make", label: "Share and get it made", hint: "Show the design to your committee, see it in photos, and ask for a price." },
];

export const START_METHODS = ["text", "sketch", "picker"] as const;
export type StartMethod = (typeof START_METHODS)[number];

/** The step named in the address. The start for anything else. */
export const stepFrom = (value: unknown): StepId =>
  typeof value === "string" && (STEP_IDS as readonly string[]).includes(value) ? (value as StepId) : "start";

/** How the person started. The garment picker for anything else. */
export const startMethodFrom = (value: unknown): StartMethod =>
  typeof value === "string" && (START_METHODS as readonly string[]).includes(value) ? (value as StartMethod) : "picker";

export function neighbours(step: StepId): { previous: StepId | null; next: StepId | null } {
  const index = STEP_IDS.indexOf(step);
  return { previous: STEP_IDS[index - 1] ?? null, next: STEP_IDS[index + 1] ?? null };
}

export interface GuideOptions {
  readonly from?: StartMethod;
  /** A sentence to send to the assistant once, when the start step opens. */
  readonly say?: string;
  readonly unit?: LengthUnit;
}

/** The address of one step of the guided flow for a design. */
export function guideAddress(projectId: string, step: StepId, options: GuideOptions = {}): string {
  const query = new URLSearchParams({ step });
  if (options.from) query.set("from", options.from);
  if (options.say) query.set("say", options.say);
  if (options.unit === "in") query.set("unit", "in");
  return `/studio/${encodeURIComponent(projectId)}/guide?${query.toString()}`;
}

export interface StartingDesign {
  readonly typeId: string;
  readonly wearer: Wearer;
}

/** Where a design starts when the words name no garment or wearer. */
export const DEFAULT_START: StartingDesign = { typeId: "crew-tee", wearer: "men" };

/** The one garment type or wearer named and not refused, or undefined when none or several are. */
function single(targets: readonly string[], kind: "type" | "wearer"): string | undefined {
  const named = [...new Set(targets.filter((target) => target.startsWith(`${kind}:`)).map((target) => target.slice(kind.length + 1)))];
  return named.length === 1 ? named[0] : undefined;
}

/**
 * The design a sentence starts from: the garment and wearer it names, else a crew neck tee for
 * men. The sentence itself is then sent to the assistant, which reads the rest of it.
 */
export function startFromSentence(sentence: string): StartingDesign {
  const stated = findMentions(sentence)
    .filter((mention) => !mention.negated)
    .map((mention) => mention.target);
  const typeId = single(stated, "type");
  const wearer = single(stated, "wearer");
  return {
    typeId: typeId !== undefined && getType(typeId) ? typeId : DEFAULT_START.typeId,
    wearer: wearer !== undefined && (WEARERS as readonly string[]).includes(wearer) ? (wearer as Wearer) : DEFAULT_START.wearer,
  };
}

/** The name a new design is given. The person can change it at any time. */
export function suggestedName(typeId: string): string {
  const type = getType(typeId);
  return type ? `New ${type.label.toLowerCase()}` : "New design";
}
