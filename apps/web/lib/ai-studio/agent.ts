import type { Tone } from "./catalogue";

/**
 * THE CREATIVE AGENT (`09` screen 2, decision 0141), over what already exists.
 *
 * The agent is not a new model. A sentence that asks something goes to Ask (spec F-S5), which only
 * ever phrases rulebook entries and names the rule each sentence comes from. A sentence that asks
 * for something starts a design in the guided flow and is sent to the design chat (F-S1, the
 * existing `startGuidedAction` and `ChatPanel`), which changes the design only through parameters and
 * layers. So the agent can never answer from outside the rulebook and never draw a garment.
 */

export type AgentRoute = "ask" | "design";

const QUESTION_WORDS = /^(what|why|how|can|could|should|is|are|does|do|which|when|where|will|would)\b/i;

/** Where a sentence goes: a question to Ask, anything else to a new design. */
export function routePrompt(text: string): AgentRoute {
  const trimmed = text.trim();
  return trimmed.endsWith("?") || QUESTION_WORDS.test(trimmed) ? "ask" : "design";
}

export interface QuickStart {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly tone: Tone;
}

/** `09` screen 2's quick-start tiles, each opening the workflow or page that does it. */
export const QUICK_STARTS: readonly QuickStart[] = [
  { id: "kit-design", label: "Kit design", href: "/ai-studio/workflow/crest-to-kit", tone: "navy" },
  { id: "product-shoot", label: "Product shoot", href: "/ai-studio/workflow/on-model-try-on", tone: "pitch" },
  { id: "kit-launch-ad", label: "Kit launch ad", href: "/ai-studio/workflow/kit-launch-ad", tone: "gold" },
  { id: "team-store-promo", label: "Team store promo", href: "/ai-studio/workflow/team-store-promo", tone: "sky" },
  { id: "matchday-content", label: "Matchday content", href: "/ai-studio/workflow/matchday-graphic", tone: "dark" },
  { id: "tech-pack", label: "Tech pack", href: "/studio", tone: "light" },
];

export interface HistoryRow {
  readonly projectId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface HistoryEntry {
  readonly projectId: string;
  readonly projectName: string;
  /** The first thing the person said, cut to a line. */
  readonly said: string;
  readonly at: string;
}

const LINE = 80;

/** The person's own words, one entry per design, newest first. A design with no name is left out. */
export function historyOf(rows: readonly HistoryRow[], names: ReadonlyMap<string, string>, limit = 20): readonly HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const row of rows) {
    const name = names.get(row.projectId);
    if (seen.has(row.projectId) || name === undefined) continue;
    seen.add(row.projectId);
    const said = row.body.length > LINE ? `${row.body.slice(0, LINE - 1).trimEnd()}…` : row.body;
    out.push({ projectId: row.projectId, projectName: name, said, at: row.createdAt });
    if (out.length >= limit) break;
  }
  return out;
}

/** The note under the prompt card (`09` screen 2's token note), in our words. */
export const TOKEN_NOTE = "Credit use depends on what the agent does. Kit designs, renders and answers from the rulebook are free.";
