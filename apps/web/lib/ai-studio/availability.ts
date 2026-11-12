import type { ProviderGate, Workflow } from "./catalogue";

/**
 * WHETHER A WORKFLOW CAN RUN HERE (decision 0141; plan v6 P3: "run behind their provider flags with
 * an honest 'not available yet' state when off").
 *
 * The switches are the ones the run engine itself reads (`lib/flows/real/server.ts` `liveKinds`), so
 * a page never offers a run the canvas would then put on the stub. A workflow whose switch is off
 * shows its form and its example, says why, and has no Generate to press: no fake output, ever.
 * Removing a background has no provider at all yet (`lib/panel-layers/background.ts`).
 */

export interface LiveSwitches {
  readonly aiImage: boolean;
  readonly aiVideo: boolean;
  readonly removeBackground: boolean;
}

export const ALL_OFF: LiveSwitches = { aiImage: false, aiVideo: false, removeBackground: false };

export type Availability = Readonly<{ available: true }> | Readonly<{ available: false; title: string; body: string }>;

const OFF: Readonly<Record<Exclude<ProviderGate, null>, Readonly<{ title: string; body: string }>>> = {
  aiImage: {
    title: "Not available yet",
    body: "AI pictures are switched off on this platform, so nothing is generated and no credits are used. Mockups of the same design are free on the Mockups page.",
  },
  aiVideo: {
    title: "Not available yet",
    body: "AI video is switched off on this platform, so no clip is made and no credits are used. The free 3D videos are in the editor's video studio.",
  },
  removeBackground: {
    title: "Not available yet",
    body: "Removing a background needs a picture service Knitwright has not wired up yet, so nothing is changed. Upload artwork with a transparent background instead.",
  },
};

export function availabilityOf(workflow: Pick<Workflow, "gate">, live: LiveSwitches): Availability {
  if (workflow.gate === null || live[workflow.gate]) return { available: true };
  return { available: false, ...OFF[workflow.gate] };
}
