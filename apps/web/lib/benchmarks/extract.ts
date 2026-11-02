import { ModelCallError, type ModelImage, type TextModelProvider } from "@/lib/providers/text-model";
import { cardFrom } from "./normalise";
import { FEATURES, type SourceKind } from "./vocabulary";
import type { BenchmarkCard } from "./schema";

/**
 * The vision-capable extraction step of F-S2, as an interface with a deterministic stub, so no test and no local run
 * reaches a paid model (plan rule). The real adapter goes through the existing provider interface (lib/providers) and
 * its existing key; it adds no vendor of its own. The parser, not the model, decides what a card may say
 * (lib/benchmarks/normalise.ts).
 */

export type ExtractInput = Readonly<{
  kind: SourceKind;
  /** The plain words of the page, or the pasted review text. Never stored. */
  words?: string;
  title?: string | null;
  /** The user's own photo, for a photo intake. Never a third-party image. */
  image?: ModelImage;
}>;

export interface BenchmarkExtractor {
  /** "stub", or the model id. Kept with the card so a reader knows what read it. */
  readonly name: string;
  extract(input: ExtractInput, signal?: AbortSignal): Promise<BenchmarkCard>;
}

/** Answers from a script, in order; the last answer repeats. Never reaches the network. */
export function createStubExtractor(answers: readonly (BenchmarkCard | Error)[]): BenchmarkExtractor & { calls: number; seen: ExtractInput[] } {
  const stub = {
    name: "stub",
    calls: 0,
    seen: [] as ExtractInput[],
    async extract(input: ExtractInput): Promise<BenchmarkCard> {
      const answer = answers[Math.min(stub.calls, answers.length - 1)];
      stub.calls += 1;
      stub.seen.push(input);
      if (answer === undefined) throw new ModelCallError("The stub was given no answer.");
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return stub;
}

export const EXTRACT_MAX_OUTPUT_TOKENS = 900;

const featureList = FEATURES.map((feature) => `${feature.key} (${feature.label})`).join(", ");

export const EXTRACT_SYSTEM = [
  "You read one sportswear product and fill in a fixed card. This is a comparison, never a copy.",
  "Answer with JSON only, in this shape:",
  '{"productName":{"value":string|null,"provenance":"observed"|"inferred"|"unknown"},"brandName":{...},',
  '"price":{"value":{"minor":integer,"currency":"GBP"}|null,"provenance":...},"gsm":{"value":integer|null,"provenance":...},',
  '"fabricComposition":{...},"fit":{...},"sizeRange":{"value":["S","M"]|null,"provenance":...},',
  '"features":[{"key":"<one of the list>","provenance":"observed"|"inferred"}],',
  '"claims":[{"value":"<the seller\'s claim in five words>","provenance":"observed"}],',
  '"complaintThemes":[{"theme":"<your own short paraphrase>","count":integer}]}',
  `Use only these feature keys: ${featureList}.`,
  "provenance observed = stated in the words you were given. inferred = you read it off the picture. unknown = you do not know.",
  "Never state a measurement you were not told: a price or a GSM you cannot read in the words is unknown.",
  "Never copy a review. Each complaint theme is your own short paraphrase of what several reviewers said.",
  "Do not describe a logo, a brand mark or a print as a feature; name the brand in brandName only.",
  "Say nothing you cannot point at. An empty card is a good answer.",
].join("\n");

const asJson = (text: string): unknown => {
  const trimmed = text.trim();
  const body = trimmed.startsWith("```") ? trimmed.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "") : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

export const userPrompt = (input: ExtractInput): string =>
  [
    `Source: ${input.kind === "url" ? "a product page" : input.kind === "photo" ? "a photograph" : "review text a person pasted"}.`,
    input.title ? `Page title: ${input.title}` : "",
    input.words ? `Words:\n${input.words}` : "",
  ]
    .filter(Boolean)
    .join("\n");

/** The real adapter. Called only when a key is configured, and never from a test. */
export function createModelExtractor(provider: TextModelProvider): BenchmarkExtractor {
  return {
    name: provider.model,
    async extract(input, signal) {
      const reply = await provider.complete({
        system: EXTRACT_SYSTEM,
        user: userPrompt(input),
        ...(input.image ? { image: input.image } : {}),
        maxOutputTokens: EXTRACT_MAX_OUTPUT_TOKENS,
        signal,
      });
      return cardFrom(asJson(reply.text), input.kind, input.words ?? "");
    },
  };
}
