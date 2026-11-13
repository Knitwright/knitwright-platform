import type { BoardView } from "@/lib/launch";
import { PRESETS as VIDEO_PRESETS } from "@/lib/media/video/prompt-presets";

/**
 * THE PROMPTS MODAL (decision 0149; `08` v3.3 "+ menu → Prompts", prototype e40): History and Presets.
 *
 * **History** is the prompts this canvas's own AI boards hold, newest board last on the canvas first --
 * read from the boards the page already has, so nothing is stored twice and nothing is invented.
 * **Presets** are starting prompts: for video, L5's own camera presets (`lib/media/video/prompt-presets.ts`);
 * for images, a short Knitwright list written for kit launches. A preset only fills the prompt box.
 */

export interface PromptRow {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
}

const IMAGE_PRESETS: readonly PromptRow[] = [
  { id: "retro-poster", title: "Retro kit poster", prompt: "A 90s-style poster with the kit hanging in a locker, halftone texture, warm film colours" },
  { id: "matchday", title: "Matchday announcement", prompt: "The kit front and centre under floodlights, smoke and flare in the air, room for fixture details" },
  { id: "flat-lay", title: "Product flat lay", prompt: "Laid flat on clean grass, top-down, soft daylight, crisp fabric texture, e-commerce ready" },
  { id: "on-model", title: "On-model hero", prompt: "An athlete wearing the kit, low-angle hero shot in the players' tunnel, cinematic side light" },
  { id: "store-launch", title: "Team store launch", prompt: "The kit on a rail in a bright club shop, shallow depth of field, welcoming and clean" },
  { id: "training", title: "Training session", prompt: "Players warming up on a frosty morning pitch, breath in the air, overcast light" },
];

/** The presets for a mode. Ask and Agentic have none. */
export function presetsFor(mode: "image" | "video" | "agentic" | "ask"): readonly PromptRow[] {
  if (mode === "image") return IMAGE_PRESETS;
  if (mode === "video") return VIDEO_PRESETS.map((one) => ({ id: one.key, title: one.label, prompt: one.prompt }));
  return [];
}

const promptOf = (board: BoardView): string => {
  const value = board.settings["prompt"];
  return typeof value === "string" ? value.trim() : "";
};

/** The prompts the canvas's AI boards hold, each once, last board first. */
export function historyOf(boards: readonly BoardView[]): readonly PromptRow[] {
  const seen = new Set<string>();
  const rows: PromptRow[] = [];
  for (const board of [...boards].reverse()) {
    if (board.kind !== "ai_image" && board.kind !== "ai_video") continue;
    const prompt = promptOf(board);
    if (prompt === "" || seen.has(prompt)) continue;
    seen.add(prompt);
    rows.push({ id: board.id, title: board.name || (board.kind === "ai_video" ? "AI video" : "AI image"), prompt });
  }
  return rows;
}

/** A search over titles and prompts, for both tabs. */
export const matching = (rows: readonly PromptRow[], query: string): readonly PromptRow[] => {
  const words = query.trim().toLowerCase();
  return words === "" ? rows : rows.filter((row) => `${row.title} ${row.prompt}`.toLowerCase().includes(words));
};
