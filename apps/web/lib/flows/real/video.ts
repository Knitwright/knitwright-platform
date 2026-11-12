import type { AssetFile } from "@/lib/launch";
import { promptFor, readBoardSettings, videoSceneAsset } from "@/lib/media/video/ai-board";
import type { BoardVideoProvider } from "@/lib/media/video/board-provider";
import { DEFAULT_CHECK_FRAMES } from "@/lib/media/video/models";
import { runAiVideo, type FrameSampler, type RunMeter } from "@/lib/media/video/run";
import { sampleTimes } from "@/lib/media/video/shot-plan";
import type { VideoType } from "@/lib/media/video/sniff";
import type { ProtectedRegion } from "@/lib/media-check";
import type { LogEvent } from "@/lib/server/core/guard";
import type { FlowCapability, FlowOutcome } from "../run";
import { FLOW_GAP_RULE } from "../types";

/**
 * THE AI VIDEO BOARD, RUN IN A FLOW THROUGH L5'S OWN RUN (decision 0133).
 *
 * `lib/media/video/run.ts` is the one paid clip: reserve, call the model, read the file, sample its
 * frames, check every frame against the garment, release on any failure. This hands a flow board to
 * it unchanged. The provider is `chooseBoardVideoProvider`'s -- the stub unless `MEDIA_VIDEO_LIVE`
 * is "true" and `FAL_KEY` is set -- and the brand's credits are the flow's, as for an AI scene.
 *
 * **The first frame is the render.** F-L3 says a clip starts from a picture the platform drew, and a
 * pack's clip is fed by an AI scene; so the first frame is drawn from the design version behind the
 * board, never taken from the scene that feeds it.
 *
 * **Two ports may be missing, and then nothing is called at all.** Decision 0095 takes a clip's frames
 * in the browser because the deploy target has no video decoder, and no table yet keeps a clip as a
 * brand's file. A flow runs on the server, so until a server sampler and a clip store exist the board
 * is refused **before** the model is asked -- a paid clip that could only ever be thrown away would
 * be money spent on nothing.
 */

export interface VideoPorts {
  /** The garment drawn from the design version, opaque, as the first frame; and its protected marks. */
  readonly firstFrame: (designProjectId: string, version: number | null) => Promise<Readonly<{ png: Uint8Array; regions: readonly ProtectedRegion[] }> | null>;
  readonly provider: BoardVideoProvider;
  readonly meter: RunMeter;
  /** Reads frames out of a clip on the server, or null where there is no decoder. */
  readonly sample: FrameSampler | null;
  /** Keeps a clip as a file of the brand, or null where nothing can keep one yet. */
  readonly store: ((video: Uint8Array, type: VideoType) => Promise<AssetFile>) | null;
  readonly log: (event: LogEvent) => void;
}

export const NO_SERVER_FRAMES_LINE =
  "An AI clip's frames are checked in the browser, and a flow runs on the server, so this clip was not made and no model was asked. Nothing was charged.";
export const NO_DESIGN_LINE = "The Design board behind this one has no design on it, so there is no first frame to start the clip from.";
export const NO_FRAME_LINE = "The design behind this board could not be drawn, so there was no first frame. Nothing was kept.";

/** How long one clip may take before it is given up. */
export const CLIP_TIMEOUT_MS = 300_000;

export function videoCapability(ports: VideoPorts): FlowCapability {
  return {
    run: async (request): Promise<FlowOutcome> => {
      const sample = ports.sample;
      const store = ports.store;
      if (sample === null || store === null) return { ok: false, reason: NO_SERVER_FRAMES_LINE, ruleId: FLOW_GAP_RULE };
      if (request.garment.designProjectId === null) return { ok: false, reason: NO_DESIGN_LINE, ruleId: FLOW_GAP_RULE };
      const frame = await ports.firstFrame(request.garment.designProjectId, request.garment.version);
      if (frame === null) return { ok: false, reason: NO_FRAME_LINE, ruleId: FLOW_GAP_RULE };

      const settings = readBoardSettings({ ...request.settings, presetKey: request.settings["presetKey"] ?? request.settings["preset"] });
      const outcome = await runAiVideo(
        { provider: ports.provider, ledger: null, meter: ports.meter, sample, log: ports.log },
        {
          request: {
            firstFrame: frame.png,
            prompt: promptFor(settings),
            seconds: settings.seconds,
            aspect: settings.aspect,
            audio: settings.audio,
            modelKey: settings.modelKey ?? "",
          },
          credits: 0,
          idempotencyKey: `${request.boardId}:${request.garment.version ?? 0}`,
          sampleMs: sampleTimes(settings.seconds * 1000, DEFAULT_CHECK_FRAMES),
          checkInput: { reference: frame.png, protectedRegions: frame.regions },
        },
        AbortSignal.timeout(CLIP_TIMEOUT_MS),
      );
      if (!outcome.ok) return { ok: false, reason: outcome.message, ruleId: outcome.ruleId };
      const file = await store(outcome.video, outcome.type);
      return { ok: true, asset: videoSceneAsset(file, false) };
    },
  };
}
