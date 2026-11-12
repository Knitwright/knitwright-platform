import type { AssetFile, BoardView, Graph, LaunchAsset } from "@/lib/launch";
import { renderMockupBoard, type DesignToDraw } from "@/lib/mockups/run";
import type { FlowCapability, FlowOutcome } from "../run";
import { FLOW_GAP_RULE } from "../types";
import { mockupSettingsOf } from "./scenes";

/**
 * THE MOCKUP BOARD, RUN FOR REAL IN A FLOW (decision 0133).
 *
 * L2's `renderMockupBoard` is the one renderer, and this calls it unchanged: it asks `runnable`,
 * takes the garment from `garmentSource`, refuses an AI scene and a chart card, draws, stores the
 * PNG and builds a `DrawnAsset`. Two things differ from the Mockups panel's own Run, and both are
 * the flow engine's business rather than the renderer's:
 *
 *   * **the record is the flow's.** `runFlow` writes a board's status and output through its own
 *     recorder after the branch check of `artwork.ts`, so the renderer's write is caught here and
 *     handed back as the outcome instead of being written twice;
 *   * **a pack's settings are read as the library's** (`scenes.ts`), so a pack's "render-front" is
 *     drawn as `product-front`. What the board has saved is not changed: only the design version it
 *     was drawn from is written back, as the panel's own Run writes it.
 *
 * A turntable or a carousel is a video, recorded in the browser from the 3D view (decision 0095),
 * and a flow runs on the server. It is refused with that sentence rather than drawn as a still and
 * filed as an MP4.
 */

export interface MockupPorts {
  readonly design: (designProjectId: string, version: number | null) => Promise<DesignToDraw | null>;
  /** Stores a PNG the platform drew, as a deterministic render. */
  readonly store: (png: Uint8Array) => Promise<AssetFile>;
  /** Writes the design version a board was drawn from, so a later version reads as stale. */
  readonly setInputVersion: (board: BoardView, version: number) => Promise<void>;
}

export const RECORDED_VIDEO_LINE =
  "A turntable or a carousel is recorded in the browser from the 3D view, and a flow runs on the server, so it was not made here. Record it from the 3D view of the design.";

export function mockupCapability(graph: Graph, ports: MockupPorts): FlowCapability {
  return {
    run: async (request): Promise<FlowOutcome> => {
      const board = graph.boards.find((one) => one.id === request.boardId);
      if (!board) return { ok: false, reason: "That board is no longer on the canvas.", ruleId: FLOW_GAP_RULE };
      if (request.format === "mp4") return { ok: false, reason: RECORDED_VIDEO_LINE, ruleId: FLOW_GAP_RULE };

      const read = { ...board, settings: mockupSettingsOf(board.settings) };
      const asRead: Graph = { boards: graph.boards.map((one) => (one.id === board.id ? read : one)), edges: graph.edges };
      let made: LaunchAsset | null = null;
      const outcome = await renderMockupBoard(
        {
          design: ports.design,
          store: ports.store,
          record: async (input) => {
            made = input.asset;
          },
          // The board as it was saved, not as it was read: the pack's own settings stay the pack's.
          setInputVersion: (_read, version) => ports.setInputVersion(board, version),
        },
        asRead,
        board.id,
      );
      if (!outcome.ok) return { ok: false, reason: outcome.reason, ruleId: outcome.ruleId };
      if (made === null) return { ok: false, reason: "The mockup was drawn but nothing was handed back to keep.", ruleId: FLOW_GAP_RULE };
      return { ok: true, asset: made };
    },
  };
}
