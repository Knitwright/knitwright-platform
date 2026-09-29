import { ModelCallError, type ModelReply, type ModelRequest, type TextModelProvider } from "./text-model";

/**
 * A provider that answers from a script, for tests and for replaying recorded replies.
 * It never reaches the network. Each answer is text, an error to throw, or a function of
 * the request.
 */
export type StubAnswer = string | Error | ((request: ModelRequest) => string);

export interface StubProvider extends TextModelProvider {
  /** Every request the stub was sent, in order. */
  readonly requests: readonly ModelRequest[];
}

export function createStubProvider(answers: readonly StubAnswer[], model = "stub-model"): StubProvider {
  const requests: ModelRequest[] = [];
  return {
    provider: "stub",
    model,
    requests,
    async complete(request): Promise<ModelReply> {
      const answer = answers[requests.length];
      requests.push(request);
      if (answer === undefined) throw new ModelCallError("The stub has no more answers.");
      if (answer instanceof Error) throw answer;
      const text = typeof answer === "function" ? answer(request) : answer;
      return { text, model, usage: { inputTokens: Math.ceil((request.system.length + request.user.length) / 4), outputTokens: Math.ceil(text.length / 4) } };
    },
  };
}
