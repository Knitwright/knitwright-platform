/**
 * The Creative Agent's address with its first words (decision 0141). Kept apart from `agent.ts` so
 * the hero card in the browser imports a few lines, not the agent's data.
 */

export const AGENT_PATH = "/ai-studio/agent";

/** The longest prompt the card takes: the guided flow's own limit (`lib/intent/text-flow`). */
export const MAX_PROMPT_LENGTH = 500;

export function agentAddress(ask: Readonly<{ say?: string; from?: "sketch" }>): string {
  const query = new URLSearchParams();
  const say = ask.say?.trim().slice(0, MAX_PROMPT_LENGTH) ?? "";
  if (say !== "") query.set("say", say);
  if (ask.from) query.set("from", ask.from);
  const text = query.toString();
  return text === "" ? AGENT_PATH : `${AGENT_PATH}?${text}`;
}
