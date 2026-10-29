import { toCapability, toColour, toCountryRule, toFabric, toFactory, toTier } from "../rows";
import type { Capability, FactorySnapshot, PriceTier } from "../schemas";
import type { FactoryStore, FactoryTable, NewTier } from "../store";
import { allRows } from "./rows";

/**
 * A FactoryStore held in memory, so the service, the profile builder and the edit path are tested without a
 * database. It starts from the same rows as the migration's seed and records every write.
 */

type Row = Record<string, unknown>;

export interface FakeStore extends FactoryStore {
  readonly writes: { table: string; id: string; columns: Row; actor: string }[];
  readonly added: NewTier[];
  rowsOf(table: FactoryTable): Row[];
}

const copy = (rows: readonly Row[]): Row[] => rows.map((row) => ({ ...row }));

export function fakeFactoryStore(overrides: Partial<Record<FactoryTable, Row[]>> = {}): FakeStore {
  const tables: Record<FactoryTable, Row[]> = {
    factories: copy(overrides.factories ?? allRows.factories),
    factory_capabilities: copy(overrides.factory_capabilities ?? allRows.factory_capabilities),
    price_tiers: copy(overrides.price_tiers ?? allRows.price_tiers),
    programme_fabrics: copy(overrides.programme_fabrics ?? allRows.programme_fabrics),
    programme_fabric_colours: copy(overrides.programme_fabric_colours ?? allRows.programme_fabric_colours),
    country_rules: copy(overrides.country_rules ?? allRows.country_rules),
  };
  const writes: FakeStore["writes"] = [];
  const added: NewTier[] = [];
  const tiers = (): PriceTier[] => tables.price_tiers.map(toTier);

  return {
    writes,
    added,
    rowsOf: (table) => tables[table],
    listFactories: async () => tables.factories.map(toFactory),
    factoryBySlug: async (slug) => tables.factories.map(toFactory).find((f) => f.slug === slug) ?? null,
    async snapshot(factory): Promise<FactorySnapshot> {
      const capabilities: Capability[] = tables.factory_capabilities
        .map(toCapability)
        .filter((c) => c.factoryId === factory.id)
        .sort((a, b) => a.articleCode.localeCompare(b.articleCode) || a.fabricCode.localeCompare(b.fabricCode));
      const ids = new Set(capabilities.map((c) => c.id));
      return { factory, capabilities, tiers: tiers().filter((t) => ids.has(t.capabilityId)), fabrics: tables.programme_fabrics.map(toFabric) };
    },
    listFabrics: async () => tables.programme_fabrics.map(toFabric),
    listColours: async () => tables.programme_fabric_colours.map(toColour),
    listCountryRules: async () => tables.country_rules.map(toCountryRule),
    ladder: async (capabilityId) => tiers().filter((t) => t.capabilityId === capabilityId),
    capabilityOfTier: async (tierId) => tiers().find((t) => t.id === tierId)?.capabilityId ?? null,
    rawRows: async (table) => copy(tables[table]),
    async update(table, id, columns, actor) {
      const row = tables[table].find((r) => r.id === id);
      if (!row) throw new Error(`No row ${id} in ${table}`);
      writes.push({ table, id, columns, actor });
      Object.assign(row, columns);
    },
    async addTier(tier, actor) {
      added.push(tier);
      tables.price_tiers.push({
        ...(allRows.price_tiers[0] as Row),
        id: `88888888-8888-4888-8888-${String(tables.price_tiers.length).padStart(12, "0")}`,
        capability_id: tier.capabilityId,
        qty_min: tier.qtyMin,
        qty_max: tier.qtyMax,
        sell_gbp_minor: null,
        rule_id: "R-GAP-000",
        label: tier.label,
        updated_by: actor,
      });
    },
  };
}
