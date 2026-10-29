import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import {
  CAPABILITY_COLUMNS,
  COLOUR_COLUMNS,
  COUNTRY_COLUMNS,
  FABRIC_COLUMNS,
  FACTORY_COLUMNS,
  TIER_COLUMNS,
  rowsOf,
  toCapability,
  toColour,
  toCountryRule,
  toFabric,
  toFactory,
  toTier,
} from "./rows";
import type { Capability, CountryRule, FabricColour, Factory, FactorySnapshot, PriceTier, ProgrammeFabric } from "./schemas";

/**
 * Reads and writes of the factory tables (migration 20261101050000_factories.sql). The tables have no browser access
 * to factories, capabilities or tiers, so this takes the server's own client (adminClient). Callers check who is
 * asking first: a platform admin for the ops page, or the server itself to work out a price or a date.
 */

export const FACTORY_TABLES = ["factories", "factory_capabilities", "price_tiers", "programme_fabrics", "programme_fabric_colours", "country_rules"] as const;
export type FactoryTable = (typeof FACTORY_TABLES)[number];

export interface NewTier {
  readonly capabilityId: string;
  readonly qtyMin: number;
  readonly qtyMax: number | null;
  readonly label: string;
}

export interface FactoryStore {
  listFactories(): Promise<readonly Factory[]>;
  factoryBySlug(slug: string): Promise<Factory | null>;
  snapshot(factory: Factory): Promise<FactorySnapshot>;
  listFabrics(): Promise<readonly ProgrammeFabric[]>;
  listColours(): Promise<readonly FabricColour[]>;
  listCountryRules(): Promise<readonly CountryRule[]>;
  /** Every tier of the capability, by the capability's id. */
  ladder(capabilityId: string): Promise<readonly PriceTier[]>;
  /** The capability a tier belongs to. Null when there is no such tier. */
  capabilityOfTier(tierId: string): Promise<string | null>;
  /** Every row of a table as stored, for the ops page's forms. */
  rawRows(table: FactoryTable): Promise<readonly Record<string, unknown>[]>;
  update(table: FactoryTable, id: string, columns: Readonly<Record<string, unknown>>, actor: string): Promise<void>;
  addTier(tier: NewTier, actor: string): Promise<void>;
}

/** The columns a table's rows are shown in, so a page draws them the same way every time. */
const NATURAL_KEY: Readonly<Record<FactoryTable, readonly string[]>> = {
  factories: ["slug"],
  factory_capabilities: ["article_code", "fabric_code"],
  price_tiers: ["capability_id", "qty_min"],
  programme_fabrics: ["code"],
  programme_fabric_colours: ["fabric_code", "name"],
  country_rules: ["country"],
};

const byNaturalKey = (table: FactoryTable) => (a: Record<string, unknown>, b: Record<string, unknown>): number => {
  for (const column of NATURAL_KEY[table]) {
    const order = String(a[column] ?? "").localeCompare(String(b[column] ?? ""), "en", { numeric: true });
    if (order !== 0) return order;
  }
  return 0;
};

/** A database refusal, in words where the schema explains it. */
function failure(error: { code?: string; message: string }): AppError {
  if (error.code === "23514" || error.code === "23502") return new AppError("invalid_input", "That value breaks a rule of the table, such as a cost without a currency.");
  if (error.code === "23505") return new AppError("invalid_input", "A row with that value already exists.");
  if (error.code === "23503") return new AppError("invalid_input", "That refers to something that does not exist.");
  return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
}

export function supabaseFactoryStore(client: SupabaseClient): FactoryStore {
  const read = async <T>(table: FactoryTable, columns: string, map: (r: Record<string, unknown>) => T, filter?: [string, string]): Promise<T[]> => {
    const query = client.from(table).select(columns);
    const { data, error } = await (filter ? query.eq(filter[0], filter[1]) : query);
    if (error) throw failure(error);
    return rowsOf(data).map(map);
  };

  return {
    listFactories: () => read("factories", FACTORY_COLUMNS, toFactory).then((list) => list.sort((a, b) => a.slug.localeCompare(b.slug))),
    async factoryBySlug(slug) {
      return (await read("factories", FACTORY_COLUMNS, toFactory, ["slug", slug]))[0] ?? null;
    },
    async snapshot(factory) {
      const capabilities: Capability[] = (await read("factory_capabilities", CAPABILITY_COLUMNS, toCapability, ["factory_id", factory.id])).sort(
        (a, b) => a.articleCode.localeCompare(b.articleCode) || a.fabricCode.localeCompare(b.fabricCode),
      );
      const ids = new Set(capabilities.map((c) => c.id));
      const [tiers, fabrics] = await Promise.all([read("price_tiers", TIER_COLUMNS, toTier), read("programme_fabrics", FABRIC_COLUMNS, toFabric)]);
      return { factory, capabilities, tiers: tiers.filter((t) => ids.has(t.capabilityId)), fabrics };
    },
    listFabrics: () => read("programme_fabrics", FABRIC_COLUMNS, toFabric).then((list) => list.sort((a, b) => a.code.localeCompare(b.code))),
    listColours: () => read("programme_fabric_colours", COLOUR_COLUMNS, toColour),
    listCountryRules: () => read("country_rules", COUNTRY_COLUMNS, toCountryRule).then((list) => list.sort((a, b) => a.country.localeCompare(b.country))),
    ladder: (capabilityId) => read("price_tiers", TIER_COLUMNS, toTier, ["capability_id", capabilityId]),
    async capabilityOfTier(tierId) {
      return (await read("price_tiers", TIER_COLUMNS, toTier, ["id", tierId]))[0]?.capabilityId ?? null;
    },
    rawRows: (table) => read(table, "*", (r) => r).then((rows) => rows.sort(byNaturalKey(table))),
    async update(table, id, columns, actor) {
      const { data, error } = await client
        .from(table)
        .update({ ...columns, updated_by: actor, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw failure(error);
      if (rowsOf(data).length === 0) throw new AppError("not_found", "That row does not exist.");
    },
    async addTier(tier, actor) {
      const { error } = await client.from("price_tiers").insert({
        capability_id: tier.capabilityId,
        qty_min: tier.qtyMin,
        qty_max: tier.qtyMax,
        label: tier.label,
        updated_by: actor,
      });
      if (error) throw failure(error);
    },
  };
}
