import { AppError } from "@/lib/server/core/errors";
import type { FactoryProfile } from "@/lib/validation/profile";
import { createKeyedCache } from "./cache";
import { promisedDate, type PromisedDate } from "./dates";
import { priceBasket, type BasketLine, type BasketPrice } from "./pricing";
import type { ProductionSettings } from "./production-settings";
import { buildFactoryProfile } from "./profile";
import type { Capability, FactorySnapshot, ProductionClass, SellCurrency } from "./schemas";
import type { FactoryStore } from "./store";

/**
 * The factory model's use cases (decision 0071): the cached profile read model, basket prices and promised dates,
 * all from rows. The store is an interface, so these run over an in-memory double in tests.
 */

export interface FactoryService {
  /** The `FactoryProfile` of a factory, by its slug. Cached; `invalidate` drops it after a change. */
  profile(slug: string): Promise<FactoryProfile>;
  /** Drops every cached profile. Called after any write to the factory tables. */
  invalidate(): void;
  price(slug: string, lines: readonly BasketLineInput[], currency: SellCurrency): Promise<BasketPrice>;
  promise(input: PromiseInput, settings: ProductionSettings): Promise<PromisedDate>;
}

export interface BasketLineInput extends BasketLine {
  /** Which fabric. When left out, the article's first capability by fabric code. */
  readonly fabricCode?: string;
}

export interface PromiseInput {
  readonly slug: string;
  readonly articleCode: string;
  readonly fabricCode?: string;
  /** The destination's country rule, for freight days. */
  readonly country: string;
  readonly orderAt: Date;
  /** When left out, the production class of the capability's fabric. */
  readonly productionClass?: ProductionClass;
}

const NO_FACTORY = "That factory does not exist.";

/** The capability for an article (and fabric), or undefined when the factory does not make it. */
export function capabilityFor(snapshot: FactorySnapshot, articleCode: string, fabricCode?: string): Capability | undefined {
  return [...snapshot.capabilities]
    .filter((c) => c.articleCode === articleCode && (fabricCode === undefined || c.fabricCode === fabricCode))
    .sort((a, b) => a.fabricCode.localeCompare(b.fabricCode))[0];
}

export function createFactoryService(store: FactoryStore, options: Readonly<{ ttlMs?: number; now?: () => number }> = {}): FactoryService {
  const snapshotOf = async (slug: string): Promise<FactorySnapshot> => {
    const factory = await store.factoryBySlug(slug);
    if (!factory) throw new AppError("not_found", NO_FACTORY);
    return store.snapshot(factory);
  };
  const cache = createKeyedCache({ load: async (slug) => buildFactoryProfile(await snapshotOf(slug)), ttlMs: options.ttlMs ?? 60_000, now: options.now });

  return {
    profile: (slug) => cache.get(slug),
    invalidate: () => cache.clear(),
    async price(slug, lines, currency) {
      const snapshot = await snapshotOf(slug);
      const withLadders = lines.map(({ fabricCode, ...line }) => {
        const capability = capabilityFor(snapshot, line.articleCode, fabricCode);
        return { ...line, ladder: capability ? snapshot.tiers.filter((t) => t.capabilityId === capability.id) : [] };
      });
      return priceBasket(withLadders, currency);
    },
    async promise(input, settings) {
      const snapshot = await snapshotOf(input.slug);
      const capability = capabilityFor(snapshot, input.articleCode, input.fabricCode);
      if (!capability) throw new AppError("not_found", "This factory does not make that article.");
      const rule = (await store.listCountryRules()).find((r) => r.country === input.country);
      if (!rule || !rule.sellingEnabled) throw new AppError("invalid_input", "Knitwright does not deliver to that country yet.");
      const fabric = snapshot.fabrics.find((f) => f.code === capability.fabricCode);
      return promisedDate({
        orderAt: input.orderAt,
        productionClass: input.productionClass ?? fabric?.productionClass ?? "A",
        timeZone: snapshot.factory.timeZone,
        cutoff: settings.cutoff,
        leadTimeDays: capability.leadTimeDays,
        qcDays: settings.qcDays,
        freightDays: rule.freightDays,
      });
    },
  };
}
