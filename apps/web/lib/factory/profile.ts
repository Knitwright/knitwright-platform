import { factoryProfileSchema, type FactoryProfile } from "@/lib/validation/profile";
import type { Capability, FactorySnapshot, PriceTier } from "./schemas";

/**
 * The factory profile read model (spec 03-data-model.md, "Factory profile"): the existing `FactoryProfile` type
 * (lib/validation/profile.ts, decision 0039), built from the factory's rows. Pure; `service.ts` caches it.
 *
 * How rows become the profile's fields:
 * - articles: one per garment type the factory makes (the capability's registry type, or its article code in
 *   lower case while no type maps to it), with the smallest agreed MOQ across its capabilities;
 * - fabrics: one per programme fabric used, with the strictest agreed colour difference;
 * - priceLadder: the GBP sell ladder of the first capability (by article code, then fabric) whose every tier has a
 *   GBP price, in pounds as the old type holds them; per-article ladders stay in the tiers (see pricing.ts);
 * - leadTimeDays: the longest agreed lead time, so no article is promised sooner than its factory can make it;
 * - fileFormats: every format any capability accepts;
 * - structuralOptions and hsCodes: not held here (the catalogue and the commercial invoice own them).
 * A value no row gives is "not-set", exactly as in the seeded default.
 */

type Settable<T> = { status: "not-set" } | { status: "set"; value: T };

const NOT_SET = { status: "not-set" } as const;
const set = <T>(value: T): Settable<T> => ({ status: "set", value });

const typeIdOf = (c: Capability): string => c.garmentTypeId ?? c.articleCode.toLowerCase();

const byKey = <T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
};

const smallest = (values: readonly (number | null)[]): Settable<number> => {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? NOT_SET : set(Math.min(...known));
};

function gbpLadder(capabilities: readonly Capability[], tiers: readonly PriceTier[]): FactoryProfile["priceLadder"] {
  const ordered = [...capabilities].sort((a, b) => a.articleCode.localeCompare(b.articleCode) || a.fabricCode.localeCompare(b.fabricCode));
  for (const capability of ordered) {
    const own = tiers.filter((t) => t.capabilityId === capability.id).sort((a, b) => a.qtyMin - b.qtyMin);
    if (own.length === 0 || own.some((t) => t.sellGbpMinor === null)) continue;
    return set(own.slice(0, 20).map((t) => ({ fromPieces: t.qtyMin, unitPrice: t.sellGbpMinor! / 100 })));
  }
  return NOT_SET;
}

export function buildFactoryProfile(snapshot: FactorySnapshot): FactoryProfile {
  const { factory, capabilities, tiers, fabrics } = snapshot;
  const fabricByCode = new Map(fabrics.map((f) => [f.code, f]));
  const leadTimes = capabilities.map((c) => c.leadTimeDays).filter((v): v is number => v !== null);
  const profile: FactoryProfile = {
    id: factory.slug,
    name: factory.name,
    label: factory.label,
    articles: [...byKey(capabilities, typeIdOf).entries()].map(([typeId, caps]) => ({ typeId, moq: smallest(caps.map((c) => c.moq)) })),
    fabrics: [...byKey(capabilities, (c) => c.fabricCode).entries()].map(([code, caps]) => {
      const fabric = fabricByCode.get(code);
      return {
        name: fabric ? `${code} ${fabric.name}` : code,
        swatchRef: fabric?.swatchRef ?? null,
        colourDelta: smallest(caps.map((c) => c.colourDeltaMax)),
      };
    }),
    structuralOptions: [],
    priceLadder: gbpLadder(capabilities, tiers),
    leadTimeDays: leadTimes.length === 0 ? NOT_SET : set(Math.max(...leadTimes)),
    fileFormats: [...new Set(capabilities.flatMap((c) => c.fileFormats.map((f) => f.toLowerCase())))].sort().slice(0, 20),
    hsCodes: NOT_SET,
  };
  return factoryProfileSchema.parse(profile);
}
