import type { Graph } from "@/lib/launch";
import type { FlowCapabilityRegistry } from "../capabilities";
import { FLOW_GAP_RULE } from "../types";
import { marketingCapability, type MarketingPorts } from "./marketing";
import { mockupCapability, type MockupPorts } from "./mockup";
import { sceneCapability, type ScenePorts } from "./scene";
import { videoCapability, type VideoPorts } from "./video";

/**
 * THE REGISTRY A REAL RUN USES (decision 0133).
 *
 * `capabilities.ts` kept an empty registry while L2 to L5 had not landed, and `runFlowForBrand` was
 * never handed another, so every board of every run -- the free renders too -- went to the stub,
 * whose made-up file ids the database then refused. This is the one that is handed in now:
 *
 *   * **mockup** and **marketing**: drawn by this platform, always, free;
 *   * **AI image** and **AI video**: through L3's and L5's own runs, whose providers stay behind
 *     `MEDIA_SHOOTS_LIVE` and `MEDIA_VIDEO_LIVE`, with each adapter's own stub when its switch is off;
 *   * **info card**: refused in words. It holds facts, and no renderer draws them into a picture
 *     yet; a stub file id would only be refused later by the database with a worse sentence.
 *
 * Design and artboard boards are never run (`runnable`), so they have nothing here.
 */

export interface RegistryPorts {
  readonly mockup: MockupPorts;
  readonly marketing: MarketingPorts;
  readonly scene: ScenePorts;
  readonly video: VideoPorts;
  /** Whether each paid kind's switch is on and its provider configured. */
  readonly live: Readonly<{ aiImage: boolean; aiVideo: boolean }>;
}

export const INFO_CARD_LINE = "An Info card holds facts, and nothing draws them into a picture yet, so this board was not run. Nothing was charged.";

/** What the run panel says about who makes each kind of board, in words a person can read. */
export function registryNote(live: RegistryPorts["live"], videoRunnable: boolean): string {
  const scene = live.aiImage
    ? "AI scenes are live: a paid model makes them, checked against your garment."
    : "AI scenes are not live (MEDIA_SHOOTS_LIVE is off), so a stand-in picture is made: your garment, unchanged, on a plain shade, labelled AI. No model is called.";
  const video = !videoRunnable
    ? "AI clips cannot run in a flow yet: their frames are checked in the browser. Nothing is charged for them."
    : live.aiVideo
      ? "AI clips are live: a paid model makes them."
      : "AI clips are not live (MEDIA_VIDEO_LIVE is off), so a stand-in clip is made. No model is called.";
  return `Mockups and marketing posts are drawn by the platform from your design, for free. ${scene} ${video} Info cards are not drawn yet.`;
}

export function flowRegistry(graph: Graph, ports: RegistryPorts): FlowCapabilityRegistry {
  const videoRunnable = ports.video.sample !== null && ports.video.store !== null;
  return {
    byKind: {
      mockup: mockupCapability(graph, ports.mockup),
      marketing: marketingCapability(graph, ports.marketing),
      ai_image: sceneCapability(ports.scene),
      ai_video: videoCapability(ports.video),
      info_card: { run: async () => ({ ok: false, reason: INFO_CARD_LINE, ruleId: FLOW_GAP_RULE }) },
    },
    note: registryNote(ports.live, videoRunnable),
  };
}
