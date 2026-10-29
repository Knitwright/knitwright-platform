import { z } from "zod";
import { ModelCallError, type ModelImage, type TextModelProvider } from "@/lib/providers/text-model";

/**
 * The vision half of logo and trademark screening (spec 05-architecture: "Vision LLM + blocklist + perceptual hash"). An
 * interface, so tests and the browser tests use the stub and no test ever calls a model. The model adapter goes through the
 * existing provider interface (lib/providers) and its existing key; it adds no vendor of its own.
 */
export type VisionFinding = Readonly<{ marks: readonly string[]; offensive: boolean }>;

export interface VisionCheck {
  /** "stub", or the model id. Kept with the check's reasons. */
  readonly name: string;
  inspect(image: ModelImage, signal?: AbortSignal): Promise<VisionFinding>;
}

/** Answers from a script, in order; the last answer repeats. Never reaches the network. */
export function createStubVisionCheck(answers: readonly (VisionFinding | Error)[] = [{ marks: [], offensive: false }]): VisionCheck & { calls: number } {
  const stub = {
    name: "stub",
    calls: 0,
    async inspect(): Promise<VisionFinding> {
      const answer = answers[Math.min(stub.calls, answers.length - 1)]!;
      stub.calls += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return stub;
}

export const VISION_SYSTEM = [
  "You screen artwork a customer uploaded to print on sportswear.",
  "Look for: a third-party logo, brand name, club crest or trademark; and offensive content (hate symbols, nudity, slurs).",
  'Answer with the reply tool. If you see none of these, use kind "changes" with an empty actions list.',
  'If you see any, use kind "rejection" and put in reason a JSON object: {"marks": ["<each brand or mark you recognise>"], "offensive": true|false}.',
  "Name only what is visible. Do not guess a brand from colours or a garment shape alone.",
].join("\n");

const findingSchema = z.object({ marks: z.array(z.string().max(120)).max(10).default([]), offensive: z.boolean().default(false) });
const replySchema = z.object({ kind: z.enum(["changes", "question", "rejection"]), reason: z.string().optional() });

const json = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Reads the model's answer: the reply tool's input, or a bare finding. Anything else is not an answer. */
export function parseVisionReply(text: string): VisionFinding {
  const value = json(text.trim());
  const bare = findingSchema.strict().safeParse(value);
  if (bare.success) return bare.data;
  const reply = replySchema.safeParse(value);
  if (!reply.success) throw new ModelCallError("The vision check's answer was not in the expected form.");
  if (reply.data.kind !== "rejection") return { marks: [], offensive: false };
  const inner = findingSchema.safeParse(json(reply.data.reason ?? ""));
  if (inner.success) return inner.data;
  // A rejection whose reason is plain words still says something was seen: keep the words as the mark, for a person to read.
  return { marks: [(reply.data.reason ?? "unnamed mark").slice(0, 120)], offensive: false };
}

export const VISION_MAX_OUTPUT_TOKENS = 300;

export function createModelVisionCheck(provider: TextModelProvider): VisionCheck {
  return {
    name: provider.model,
    async inspect(image, signal) {
      const reply = await provider.complete({
        system: VISION_SYSTEM,
        user: "Screen this artwork.",
        image,
        maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
        signal,
      });
      return parseVisionReply(reply.text);
    },
  };
}
