import type { TextModelProvider } from "@/lib/providers/text-model";

/**
 * A deterministic stand-in for the browser tests (AI_PROVIDER_STUB). It never reaches the network.
 * It reads "darker sleeves" / "sleeves navy" and "slim fit" and nothing else.
 */
const reply = (words: string): string => {
  if (/sleeve/i.test(words)) return JSON.stringify({ kind: "diff", diff: { kind: "set-colour", panels: ["sleeve-left", "sleeve-right"], colour: "navy" } });
  if (/slim/i.test(words)) return JSON.stringify({ kind: "diff", diff: { kind: "change-option", optionId: "fit", choiceId: "slim" } });
  return JSON.stringify({ kind: "unsupported" });
};

export const standInDiffProvider = (): TextModelProvider => ({
  provider: "stand-in",
  model: "stand-in",
  async complete(request) {
    const at = request.user.lastIndexOf("string:\n");
    let words = "";
    try {
      words = String(JSON.parse(request.user.slice(at + "string:\n".length)));
    } catch {
      words = "";
    }
    return { text: reply(words), model: "stand-in", usage: { inputTokens: 1, outputTokens: 1 } };
  },
});
