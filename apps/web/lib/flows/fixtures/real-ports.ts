import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { flatModels } from "@/lib/images/reference";
import type { AssetFile, BoardView } from "@/lib/launch";
import { buildReference } from "@/lib/media/lifestyle/reference";
import { stubBoardVideoProvider } from "@/lib/media/video/board-provider";
import { stubShootProvider } from "@/lib/shoots/stub";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import type { RegistryPorts } from "../real/registry";

/**
 * The ports of a real run, with a memory for a bucket and a database (tests only). Everything that
 * draws is real -- the mockup renderer, the marketing layout, the garment reference, the shoot run
 * and its checker -- and nothing calls a network: the providers are each adapter's own stub.
 */

const design = (): GarmentSpec => start("crew-tee") as unknown as GarmentSpec;

const uuidOf = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

export interface MemoryPorts {
  readonly ports: RegistryPorts;
  /** Every file stored, by id, with what it was stored as. */
  readonly files: Map<string, Readonly<{ bytes: Uint8Array; provenance: "deterministic" | "generated" }>>;
  readonly versions: { boardId: string; version: number }[];
  readonly reservations: { reserved: string[]; released: string[] };
  readonly providerCalls: { video: number };
}

export function memoryPorts(over: Partial<RegistryPorts> = {}): MemoryPorts {
  const files = new Map<string, Readonly<{ bytes: Uint8Array; provenance: "deterministic" | "generated" }>>();
  const versions: { boardId: string; version: number }[] = [];
  const reservations = { reserved: [] as string[], released: [] as string[] };
  const providerCalls = { video: 0 };
  let next = 1;
  const keep = (provenance: "deterministic" | "generated") => async (bytes: Uint8Array): Promise<AssetFile> => {
    const fileId = uuidOf(next++);
    files.set(fileId, { bytes, provenance });
    return { fileId, contentType: "image/png" };
  };
  const reference = async () => {
    const models = flatModels(design(), DEFAULT_CHART_SET);
    if (!models) return null;
    return await buildReference({ ...models, images: new Map() });
  };
  const meter = {
    reserve: async () => {
      const eventId = `event-${reservations.reserved.length + 1}`;
      reservations.reserved.push(eventId);
      return { ok: true as const, eventId };
    },
    release: async (eventId: string) => {
      reservations.released.push(eventId);
    },
  };
  const videoProvider = stubBoardVideoProvider();
  const ports: RegistryPorts = {
    mockup: {
      design: async (_id, version) => ({ spec: design(), charts: DEFAULT_CHART_SET, images: new Map(), version: version ?? 1 }),
      store: keep("deterministic"),
      setInputVersion: async (board: BoardView, version: number) => {
        versions.push({ boardId: board.id, version });
      },
    },
    marketing: { read: async (fileId) => files.get(fileId)?.bytes ?? null, store: keep("deterministic") },
    scene: {
      reference: async () => {
        const made = await reference();
        return made === null ? null : { garment: made.garment, regions: made.regions };
      },
      provider: () => ({ provider: stubShootProvider(), live: false }),
      meter,
      screen: async () => ({ result: "clear", reasons: [] }),
      store: keep("generated"),
      log: () => undefined,
      newId: () => uuidOf(900_000 + next++),
    },
    video: {
      firstFrame: async () => {
        const made = await reference();
        return made === null ? null : { png: made.opaque, regions: made.regions };
      },
      provider: {
        ...videoProvider,
        generate: async (...args) => {
          providerCalls.video += 1;
          return await videoProvider.generate(...args);
        },
      },
      meter,
      sample: null,
      store: null,
      log: () => undefined,
    },
    live: { aiImage: false, aiVideo: false },
    ...over,
  };
  return { ports, files, versions, reservations, providerCalls };
}
