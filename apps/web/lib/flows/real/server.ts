import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import type { Graph } from "@/lib/launch";
import { saveBoard, type Who } from "@/lib/launch/service";
import { loadStudioDesign } from "@/lib/media/design";
import { buildReference } from "@/lib/media/lifestyle/reference";
import { chooseBoardVideoProvider } from "@/lib/media/video/board-provider";
import type { RunMeter } from "@/lib/media/video/run";
import { generationGate } from "@/lib/moderation/server";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { getProjectAt } from "@/lib/projects/service";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { chooseShootProvider, type ShootEnv } from "@/lib/shoots/adapter";
import { createFileReader, TOO_LARGE } from "@/lib/storage/read";
import { storeImage } from "@/lib/storage/store";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import type { FlowCapabilityRegistry } from "../capabilities";
import { flowRegistry, registryNote, type RegistryPorts } from "./registry";

/**
 * The real ports of a flow run (decision 0133): the design reads, the bucket, L1's board writer, the
 * usage meter, X8's generation screen and each paid adapter's own provider choice. The rules are in
 * the capabilities and the registry, which are tested on their own (`registry.test.ts`); this file
 * only joins them to the platform, and the database and end-to-end tests cover the joining.
 *
 * Reads go through the member's own client, as the Mockups panel's own Run reads them
 * (`lib/mockups/actions.ts`); writes go through the admin client with the brand and the person,
 * which every database function checks again.
 */

/** Largest picture a flow reads back to place in a layout. A board's own output is a few MB at most. */
const MAX_READ_BYTES = 25 * 1024 * 1024;

/** The paid switches, as the adapters themselves read them. Never a second copy of their rules. */
export function liveKinds(): RegistryPorts["live"] {
  const env = getEnv();
  return {
    aiImage: chooseShootProvider(process.env as ShootEnv, { group: "product" }).live,
    aiVideo: Boolean(env.FAL_KEY) && env.MEDIA_VIDEO_LIVE === "true",
  };
}

/** The run panel's note for the switches as they are now. No server sampler exists (decision 0095). */
export const liveNote = (): string => registryNote(liveKinds(), false);

/** The platform's own spend on a paid picture or clip, reserved from the photoreal allowance. */
function usageMeter(who: Who, route: string): RunMeter {
  return {
    reserve: async (microdollars) => {
      const answer = await productionDeps.usage.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "photoreal", microdollars }, route });
      return answer.ok ? { ok: true, eventId: answer.eventId } : { ok: false, refused: answer.refused };
    },
    release: async (eventId) => {
      await productionDeps.usage.refund(eventId);
    },
  };
}

export interface RunContext {
  readonly client: SupabaseClient;
  readonly who: Who;
  readonly launchProjectId: string;
  /** Which action asked, kept with the usage event and the moderation record. */
  readonly route: string;
}

export function productionPorts(context: RunContext): RegistryPorts {
  const { client, who, launchProjectId, route } = context;
  const admin = adminClient();
  const store = (provenance: "deterministic" | "generated") => async (bytes: Uint8Array) => {
    const stored = await storeImage({ admin, brandId: who.brandId, userId: who.userId, kind: "render", provenance, bytes, statedType: "image/png" });
    return { fileId: stored.id, contentType: stored.contentType };
  };
  const reference = async (designProjectId: string, version: number | null) => {
    const design = await loadStudioDesign(client, who.brandId, designProjectId, version ?? undefined).catch(() => null);
    return design === null ? null : await buildReference(design);
  };
  const reader = createFileReader(client, who.brandId);
  const env = getEnv();
  const meter = usageMeter(who, route);

  return {
    mockup: {
      design: async (designProjectId, version) => {
        const [project, charts] = await Promise.all([
          getProjectAt(client, who.brandId, designProjectId, version ?? undefined).catch(() => null),
          brandChartSet(client, who.brandId),
        ]);
        if (project === null) return null;
        const { images } = await loadArtworkImages(createFileReader(client, who.brandId), shrinkForDrawing, project.spec);
        return { spec: project.spec, charts, images, version: project.currentVersion };
      },
      store: store("deterministic"),
      setInputVersion: async (board, version) => {
        await saveBoard(admin, who, {
          launchProjectId,
          boardId: board.id,
          kind: board.kind,
          name: board.name,
          x: board.at.x,
          y: board.at.y,
          width: board.size.width,
          height: board.size.height,
          settings: board.settings,
          inputVersion: version,
        });
      },
    },
    marketing: {
      read: async (fileId) => {
        const read = await reader.read(fileId, MAX_READ_BYTES).catch(() => null);
        return read === null || read === TOO_LARGE ? null : read.bytes;
      },
      store: store("deterministic"),
    },
    scene: {
      reference: async (designProjectId, version) => {
        const made = await reference(designProjectId, version);
        return made === null ? null : { garment: made.garment, regions: made.regions };
      },
      provider: (group) => chooseShootProvider(process.env as ShootEnv, { group }),
      meter,
      screen: generationGate(who, route),
      store: store("generated"),
      log,
      newId: randomUUID,
    },
    video: {
      firstFrame: async (designProjectId, version) => {
        const made = await reference(designProjectId, version);
        return made === null ? null : { png: made.opaque, regions: made.regions };
      },
      provider: chooseBoardVideoProvider({ FAL_KEY: env.FAL_KEY, MEDIA_VIDEO_LIVE: env.MEDIA_VIDEO_LIVE }),
      meter,
      // No decoder on the deploy target and no table that keeps a clip as a brand's file (decision
      // 0095), so the clip is refused before the model is asked (`video.ts`).
      sample: null,
      store: null,
      log,
    },
    live: liveKinds(),
  };
}

/** The registry a real run is handed. */
export const productionRegistry = (context: RunContext, graph: Graph): FlowCapabilityRegistry => flowRegistry(graph, productionPorts(context));
