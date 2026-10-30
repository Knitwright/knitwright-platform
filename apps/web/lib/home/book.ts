import type { Capability, FabricColour, FactorySnapshot, ProgrammeFabric } from "@/lib/factory/schemas";
import { capabilityFor } from "@/lib/factory/service";
import type { FactoryStore } from "@/lib/factory/store";
import { log } from "@/lib/server/log";
import type { PriceSource } from "./price";

/**
 * What the catalogue and the article page read from the factory model (X6, decision 0071): the
 * price tiers and the smallest order for each article, the fabric programme and its stock colours.
 *
 * The store is a parameter, so this runs over X6's in-memory double in a unit test and over the
 * real tables in a database test. `lib/home/reads.ts` joins it to the server's own client.
 *
 * A failed read never stops the catalogue opening. It comes back empty, and every price then reads
 * "not set yet" — which is the truth about what the page could read.
 */

export interface PriceBook {
  /** The ladder and the smallest order for one article code. */
  source(articleCode: string): PriceSource;
  capability(articleCode: string): Capability | undefined;
  readonly fabrics: readonly ProgrammeFabric[];
  readonly colours: readonly FabricColour[];
  /** The factory the prices came from, or null when none could be read. */
  readonly factoryName: string | null;
}

export const EMPTY_BOOK: PriceBook = {
  source: () => ({ ladder: [], moq: null }),
  capability: () => undefined,
  fabrics: [],
  colours: [],
  factoryName: null,
};

const bookOf = (snapshot: FactorySnapshot, colours: readonly FabricColour[]): PriceBook => ({
  capability: (code) => capabilityFor(snapshot, code),
  source: (code) => {
    const found = capabilityFor(snapshot, code);
    return {
      ladder: found ? snapshot.tiers.filter((tier) => tier.capabilityId === found.id) : [],
      moq: found?.moq ?? null,
    };
  },
  fabrics: snapshot.fabrics,
  colours,
  factoryName: snapshot.factory.name,
});

/**
 * The prices, fabrics and colours of the first factory on file. Choosing a factory per article, and
 * per market, is a later wave's job; until then the catalogue shows the one partner's placeholder
 * ladder.
 */
export async function priceBookOf(store: FactoryStore): Promise<PriceBook> {
  try {
    const factory = (await store.listFactories())[0];
    if (!factory) return EMPTY_BOOK;
    const [snapshot, colours] = await Promise.all([store.snapshot(factory), store.listColours()]);
    return bookOf(snapshot, colours);
  } catch (error) {
    log({ level: "warn", message: "The catalogue's prices and fabrics could not be read", where: "catalogue prices", error });
    return EMPTY_BOOK;
  }
}
