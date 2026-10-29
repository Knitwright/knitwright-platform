import type { Metadata } from "next";
import { promisedDate } from "@/lib/factory/dates";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import { factoryService, factoryStore } from "@/lib/factory/server";
import { FACTORY_TABLES, type FactoryStore } from "@/lib/factory/store";
import { adminClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";
import { CutoffSummary, FactorySection, RowsSection, type RowsByTable } from "./sections";

export const metadata: Metadata = { title: "Ops: factories", robots: { index: false, follow: false } };

const DEFAULT_ZONE = "Asia/Karachi";

/** Every row of every factory table, by table and then by id, for the forms. */
async function rowsByTable(store: FactoryStore): Promise<RowsByTable> {
  const entries = await Promise.all(
    FACTORY_TABLES.map(async (table) => [table, new Map((await store.rawRows(table)).map((row) => [String(row.id), row]))] as const),
  );
  return Object.fromEntries(entries) as unknown as RowsByTable;
}

/**
 * Factories, what they make, price tiers, the fabric programme and country rules (decision 0071), each value
 * editable by a platform admin. Every seeded value is a placeholder and its source line says so.
 */
export default async function OpsFactoriesPage() {
  await requirePlatformAdmin();
  const store = factoryStore();
  const now = new Date();
  const [factories, rules, settings, rows] = await Promise.all([
    store.listFactories(),
    store.listCountryRules(),
    loadProductionSettings(adminClient()),
    rowsByTable(store),
  ]);
  const gb = rules.find((r) => r.country === "GB");
  const sections = await Promise.all(
    factories.map(async (factory) => {
      const snapshot = await store.snapshot(factory);
      const profile = await factoryService().profile(factory.slug);
      const promises = new Map(
        snapshot.capabilities.map((c) => {
          const productionClass = snapshot.fabrics.find((f) => f.code === c.fabricCode)?.productionClass ?? "A";
          const input = { orderAt: now, productionClass, timeZone: factory.timeZone, cutoff: settings.cutoff, leadTimeDays: c.leadTimeDays, qcDays: settings.qcDays, freightDays: gb?.freightDays ?? null };
          return [c.id, promisedDate(input)] as const;
        }),
      );
      return { snapshot, profile, promises };
    }),
  );

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Factories</h1>
      <p className="mt-2 text-[15px] text-muted">
        Prices, tiers, lead times and country rules are data. Every seeded value is a placeholder until a factory or an adviser agrees it.
        Money is typed in pounds or dollars and kept in pence or cents.
      </p>
      <CutoffSummary settings={settings} timeZone={factories[0]?.timeZone ?? DEFAULT_ZONE} now={now} />
      {sections.map((s) => <FactorySection key={s.snapshot.factory.id} {...s} rows={rows} />)}
      <RowsSection title="Fabric programme" table="programme_fabrics" rows={[...rows.programme_fabrics.values()]} heading={(r) => `${String(r.code)} ${String(r.name)}`} />
      <RowsSection title="Stock colours" table="programme_fabric_colours" rows={[...rows.programme_fabric_colours.values()]} heading={(r) => `${String(r.fabric_code)}: ${String(r.name)}`} />
      <RowsSection title="Country rules" table="country_rules" rows={[...rows.country_rules.values()]} heading={(r) => `${String(r.country)} ${String(r.name)}${r.selling_enabled ? "" : " (closed)"}`} />
    </main>
  );
}
