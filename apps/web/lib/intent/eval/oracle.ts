import { ModelCallError, type TextModelProvider } from "@/lib/providers/text-model";
import type { EvalCase } from "./schema";

/**
 * A stand-in model that answers every prompt with the fixture's own expected answer. It never
 * touches the network and costs nothing. A run against it must score 100%; if it does not, the
 * fixtures and the reply parser disagree. It says nothing about any real model.
 */
export function createOracleProvider(cases: readonly EvalCase[]): TextModelProvider {
  const byPrompt = new Map(cases.map((item) => [item.prompt, item]));
  return {
    provider: "stub",
    model: "oracle",
    async complete(request) {
      const asked = JSON.parse(request.user) as { request?: unknown };
      const item = typeof asked.request === "string" ? byPrompt.get(asked.request) : undefined;
      if (!item) throw new ModelCallError("The oracle does not know this prompt.");
      const { expected } = item;
      const text = JSON.stringify({
        article: expected.kind === "article" ? expected.articleId : null,
        candidates: expected.kind === "ambiguous" ? expected.candidates : [],
        colours: (item.colours ?? []).map((hex) => ({ name: hex, hex })),
        nearest: expected.kind === "out-of-catalogue" ? expected.nearest.articleId : null,
        difference: expected.kind === "out-of-catalogue" ? expected.nearest.difference : "",
      });
      return { text, model: "oracle", usage: { inputTokens: Math.ceil((request.system.length + request.user.length) / 4), outputTokens: Math.ceil(text.length / 4) } };
    },
  };
}
