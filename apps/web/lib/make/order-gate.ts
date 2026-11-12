import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { destinationLabel, type DestinationLabel } from "@/lib/compliance/labels";
import type { ModerationState, ProductionClass } from "@/lib/compliance/model";
import { CARE_SYMBOL_COLUMNS, toCareSymbol } from "@/lib/compliance/rows";
import { factoryStore } from "@/lib/factory/server";
import type { GarmentSpec } from "@/lib/garment/spec-schema";
import { readTechPack } from "@/lib/projects/tech-pack-load";
import { buildPackFor } from "@/lib/projects/tech-pack-data";
import { getRelease } from "@/lib/releases/service";
import { AppError } from "@/lib/server/core/errors";
import { livePorts } from "@/lib/validation/live-ports";
import { assertOrderable } from "@/lib/validation/order-gate";
import { checklistAtOrder, checklistForOrder, type OrderFlag } from "./order-checks";

/**
 * EVERY ORDER PATH'S VALIDATION GATE (plan v6 D1, decision 0132). The make flow's sample and run, the order
 * modal's run and the brand workspace's run all call `gateOrder` immediately before they send anything:
 *
 *   1. The design version the release froze is checked again and the result stored (spec F-0). A blocker refuses
 *      the order here in plain words; the database refuses the same result again inside
 *      `submit_order_for_production`, so a path that forgot this call would still be stopped.
 *   2. The content screen and the Class B review run (`screen`, which is the caller's `guardOrder`), after the
 *      validation, so a person is told the cheaper thing first.
 *   3. The F-G2 checklist runs over that version's tech pack with what the order knows laid over it
 *      (`subjectForOrder`), and comes back as flags for ops, or as a refusal once `CHECKLIST_REFUSES_ORDER` is on.
 *
 * Every read is the person's own client except the factory rows and the stored result, which decision 0071 and
 * `record_validation_result` both give to the server's key.
 */

export interface OrderGateContext {
  readonly client: SupabaseClient;
  readonly admin: SupabaseClient;
  readonly who: Readonly<{ brandId: string; userId: string }>;
  readonly brandName: string;
  /** ISO 3166 alpha-2 of the market the pieces go to: its label is what the checklist reads. */
  readonly country: string;
}

export interface OrderToGate {
  readonly projectId: string;
  readonly releaseId: string;
  readonly productionClass: ProductionClass;
  /** The colour difference the factory agreed for this article. Null: none agreed. */
  readonly colourToleranceMax: number | null;
}

/** Runs the content screen and the Class B review, and says what the screen found. Throws on a refusal. */
export type Screen = () => Promise<ModerationState>;

/** The whole gate, as the order paths are given it, so their tests can pass a double. */
export type OrderValidationGate = (order: OrderToGate, screen: Screen) => Promise<readonly OrderFlag[]>;

/** The label of the one market the pieces go to, from the rows the platform holds. None when it has no row. */
async function labelsFor(admin: SupabaseClient, country: string, spec: GarmentSpec, sizes: readonly string[]): Promise<readonly DestinationLabel[]> {
  const [rules, care] = await Promise.all([factoryStore().listCountryRules(), admin.from("care_symbols").select(CARE_SYMBOL_COLUMNS).order("code")]);
  if (care.error) throw new AppError("internal", "The label rules could not be read.", undefined, { cause: care.error });
  const rule = rules.find((one) => one.country === country);
  if (!rule) return [];
  return [
    destinationLabel({
      country: rule.country,
      countryName: rule.name,
      sellingEnabled: rule.sellingEnabled,
      labelRules: rule.labelRules,
      ruleId: rule.ruleId,
      fabric: null,
      wearer: spec.wearer,
      sizes,
      importer: null,
      cpsiaCertificate: null,
      careSymbols: ((care.data ?? []) as Record<string, unknown>[]).map(toCareSymbol),
    }),
  ];
}

export const orderValidationGate =
  (context: OrderGateContext): OrderValidationGate =>
  async (order, screen) => {
    const { client, admin, who } = context;
    const release = await getRelease(client, who.brandId, order.projectId, order.releaseId);
    const reads = await readTechPack(client, who.brandId, order.projectId, release.snapshot.specVersion);
    await assertOrderable({ admin, ports: livePorts(admin) }, who, { projectId: order.projectId, version: release.snapshot.specVersion, spec: reads.project.spec });

    const moderation = await screen();
    const pack = buildPackFor({ ...reads, brandName: context.brandName, now: new Date() });
    const sizes = pack.measurements.columns.flatMap((column) => (column.size === null ? [] : [column.size]));
    const result = checklistForOrder(pack, {
      labels: await labelsFor(admin, context.country, reads.project.spec, sizes),
      productionClass: order.productionClass,
      // `screen` has already refused a Class B run nobody allowed, so reaching here means a person did.
      humanAllowed: order.productionClass === "B" ? true : null,
      moderation,
      colourToleranceMax: order.colourToleranceMax,
    });
    const verdict = checklistAtOrder(result);
    if (verdict.status === "refused") throw new AppError("conflict", verdict.message);
    return verdict.flags;
  };
