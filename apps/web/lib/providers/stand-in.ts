import { getType } from "@/lib/garment";
import { findMentions } from "@/lib/intent/mentions";
import type { WireAction } from "@/lib/intent/reply-schema";
import { DEFAULT_MODEL, modelEntry } from "./catalog";
import type { ModelChoice } from "./select";
import type { ModelRequest, TextModelProvider } from "./text-model";

/**
 * A stand-in for the assistant's model, for the browser tests only (plan step 15 acceptance:
 * "with stubbed providers"). It never reaches the network. It reads the garment, wearer and
 * choices a sentence names, as a careful model would, and reads every picture as the same
 * sketch of a polo shirt. It is switched on by AI_PROVIDER_STUB, which the environment check
 * refuses wherever real people sign in (lib/config/env.ts).
 */

/** The garment every picture is read as. */
export const STAND_IN_SKETCH_TYPE = "polo";

const INSTRUCTION = "Customer's instruction, as a JSON string:\n";
const DESIGN = "Current design:\n";

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** The person's words and the design's type, from the text the intent path sends. */
function readRequest(user: string): { words: string; typeId: string | undefined } {
  const at = user.indexOf(INSTRUCTION);
  const words = at < 0 ? "" : parsed(user.slice(at + INSTRUCTION.length).trim());
  const designEnd = user.indexOf("\n\n");
  const design = user.startsWith(DESIGN) ? parsed(user.slice(DESIGN.length, designEnd < 0 ? undefined : designEnd)) : null;
  const typeId = design && typeof design === "object" && "typeId" in design ? String(design.typeId) : undefined;
  return { words: typeof words === "string" ? words : "", typeId };
}

function actionFor(target: string, typeId: string | undefined): WireAction | null {
  const [kind, first, second] = target.split(":");
  if (kind === "type") return { type: "change-type", typeId: first };
  if (kind === "wearer") return { type: "change-wearer", wearer: first as "men" | "women" | "youth" };
  const offers = typeId !== undefined && getType(typeId)?.options.some((option) => option.id === first);
  return kind === "choice" && offers ? { type: "set-option", optionId: first, choiceId: second } : null;
}

function textReply(user: string): string {
  const { words, typeId } = readRequest(user);
  const targets = [...new Set(findMentions(words).filter((mention) => !mention.negated).map((mention) => mention.target))];
  const types = targets.filter((target) => target.startsWith("type:"));
  const target = types.length === 1 ? types[0].slice("type:".length) : typeId;
  const seen = new Set<string>();
  const actions = targets.flatMap((entry) => {
    const action = actionFor(entry, target);
    const slot = action?.type === "set-option" ? `option:${action.optionId}` : action?.type;
    if (!action || slot === undefined || seen.has(slot)) return [];
    seen.add(slot);
    return [action];
  });
  // A change of garment goes first, so the choices are read against the new garment.
  actions.sort((a, b) => Number(b.type === "change-type") - Number(a.type === "change-type"));
  return JSON.stringify(
    actions.length > 0
      ? { kind: "changes", actions }
      : { kind: "rejection", reason: "The stand-in model found no garment or choice it knows in that." },
  );
}

const SKETCH_READING = JSON.stringify({
  kind: "changes",
  actions: [
    { type: "change-type", typeId: STAND_IN_SKETCH_TYPE },
    { type: "set-option", optionId: "fit", choiceId: "slim" },
  ],
});

const MODEL = "stand-in";

const standInProvider = (): TextModelProvider => ({
  provider: "stand-in",
  model: MODEL,
  async complete(request: ModelRequest) {
    const text = request.image ? SKETCH_READING : textReply(request.user);
    return { text, model: MODEL, usage: { inputTokens: 1, outputTokens: 1 } };
  },
});

/** The stand-in as the assistant's only model, charged at the default model's prices. */
export const standInModels = (): ModelChoice => ({
  primary: { provider: standInProvider(), entry: modelEntry(DEFAULT_MODEL) },
  retry: null,
});
