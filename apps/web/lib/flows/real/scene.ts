import type { AssetFile } from "@/lib/launch";
import type { RunMeter } from "@/lib/media/video/run";
import type { ProtectedRegion } from "@/lib/media-check";
import type { SceneGroup } from "@/lib/mockups/types";
import type { LogEvent } from "@/lib/server/core/guard";
import { cropOf, readBoardSettings } from "@/lib/shoots/board";
import type { ShootProvider } from "@/lib/shoots/provider";
import { runShoot, shootSceneAsset, type ScreenGeneration } from "@/lib/shoots/run";
import type { FlowCapability, FlowOutcome, FlowRunRequest } from "../run";
import { FLOW_GAP_RULE } from "../types";
import { cropOfSettings, sceneOfBoard } from "./scenes";

/**
 * THE AI IMAGE BOARD, RUN IN A FLOW THROUGH L3'S OWN SHOOT (decision 0133).
 *
 * There is one paid shoot in this platform and it is `lib/shoots/run.ts`: reserve the platform's
 * spend, call the model, screen the picture through X8, measure the garment against the render, try
 * once more when it drifted, and release every reservation on any failure. This hands a flow board
 * to it and adds nothing to it.
 *
 * **Which model is the adapter's choice, behind its own switch.** `chooseShootProvider` gives the
 * stub unless `MEDIA_SHOOTS_LIVE` is exactly "true" and a picture provider is configured, so with
 * the switch off a board still runs end to end -- the stub's picture is the garment, unchanged, on a
 * plain shade, labelled as AI -- and nothing is called and nothing costs the platform.
 *
 * **The brand's credits are the flow's.** `runFlow` charges a paid board through the credit ledger
 * before it runs and gives the credits back the moment it fails, so the shoot is given no ledger of
 * its own: one board, one charge, one refund.
 *
 * **The garment is the render.** The reference the model is given and the checker measures against
 * is drawn from the design version behind the board (`lib/media/lifestyle/reference.ts`), never from
 * a picture a model made, whatever feeds the board.
 */

export interface ScenePorts {
  /** The garment drawn from the design version: the PNG a model keeps, and its protected marks. */
  readonly reference: (designProjectId: string, version: number | null) => Promise<Readonly<{ garment: Uint8Array; regions: readonly ProtectedRegion[] }> | null>;
  /** The provider in use for a scene of this group, and whether it is a paid one. */
  readonly provider: (group: SceneGroup) => Readonly<{ provider: ShootProvider; live: boolean }>;
  readonly meter: RunMeter;
  readonly screen: ScreenGeneration;
  /** Stores a picture a model made (or the stub stood in for), as generated. */
  readonly store: (png: Uint8Array) => Promise<AssetFile>;
  readonly log: (event: LogEvent) => void;
  /** A fresh id for the moderation record of this run. */
  readonly newId: () => string;
}

export const NO_DESIGN_LINE = "The Design board behind this one has no design on it, so there is no garment to put in the scene.";
export const NO_REFERENCE_LINE = "The design behind this board could not be drawn, so there was no garment to put in the scene. Nothing was kept.";

/** How long one shoot may take before it is given up, both attempts together. */
export const SHOOT_TIMEOUT_MS = 120_000;

/** A seed that is the same for the same board and the same remix, and different for a new remix. */
export function sceneSeed(request: FlowRunRequest, attempt: number): number {
  const remix = typeof request.settings["remix"] === "number" ? request.settings["remix"] : 0;
  const text = `${request.boardId}|${request.garment.version ?? 0}|${remix}|${attempt}`;
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 2_147_483_647;
}

export function sceneCapability(ports: ScenePorts): FlowCapability {
  return {
    run: async (request): Promise<FlowOutcome> => {
      if (request.garment.designProjectId === null) return { ok: false, reason: NO_DESIGN_LINE, ruleId: FLOW_GAP_RULE };
      const reference = await ports.reference(request.garment.designProjectId, request.garment.version);
      if (reference === null) return { ok: false, reason: NO_REFERENCE_LINE, ruleId: FLOW_GAP_RULE };

      const settings = readBoardSettings(request.settings);
      const scene = sceneOfBoard(request.settings);
      const group: SceneGroup = scene?.group ?? "product";
      const crop = cropOfSettings(request.settings) ?? cropOf(settings.aspect, scene?.crops ?? []);
      const showsPerson = scene !== null ? scene.people !== "none" : request.settings["showsPerson"] === true;
      const { provider } = ports.provider(group);

      const outcome = await runShoot(
        { provider, ledger: null, meter: ports.meter, screen: ports.screen, log: ports.log },
        {
          request: {
            garment: reference.garment,
            extraGarments: [],
            modelPhoto: null,
            background: null,
            prompt: settings.prompt,
            crop,
            sceneSlug: scene?.slug ?? "studio",
            seed: sceneSeed(request, 1),
          },
          credits: 0,
          idempotencyKey: `${request.boardId}:${sceneSeed(request, 0)}`,
          jobId: ports.newId(),
          checkInput: { reference: reference.garment, protectedRegions: reference.regions },
          showsPerson,
          seedFor: (attempt) => sceneSeed(request, attempt),
        },
        AbortSignal.timeout(SHOOT_TIMEOUT_MS),
      );
      if (!outcome.ok) return { ok: false, reason: outcome.message, ruleId: outcome.ruleId };
      const file = await ports.store(outcome.png);
      return { ok: true, asset: shootSceneAsset(file, showsPerson) };
    },
  };
}
