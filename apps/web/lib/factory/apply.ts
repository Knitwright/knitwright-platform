import { AppError } from "@/lib/server/core/errors";
import { findField, parseFieldInput, type EditableField } from "./edit";
import { ladderProblem } from "./pricing";
import { GAP_RULE_ID, type PriceTier } from "./schemas";
import type { FactoryStore } from "./store";

/**
 * Writes one change from the ops page. The caller has already checked the person is a platform admin. A change to a
 * tier's quantities is refused when the capability's ladder would then overlap or leave a gap.
 */

export interface FieldEdit {
  readonly table: string;
  readonly id: string;
  readonly column: string;
  readonly value: string;
}

const invalid = (message: string) => new AppError("invalid_input", message, { value: [message] });

async function checkLadder(store: FactoryStore, capabilityId: string, change: (tiers: readonly PriceTier[]) => readonly PriceTier[]): Promise<void> {
  const problem = ladderProblem(change(await store.ladder(capabilityId)));
  if (problem) throw invalid(problem);
}

const isQuantity = (field: EditableField): boolean => field.table === "price_tiers" && (field.column === "qty_min" || field.column === "qty_max");

export async function applyEdit(store: FactoryStore, actor: string, edit: FieldEdit): Promise<EditableField> {
  const field = findField(edit.table, edit.column);
  if (!field) throw new AppError("invalid_input", "That field cannot be changed here.");
  const parsed = parseFieldInput(field, edit.value);
  if (!parsed.ok) throw invalid(parsed.message);
  if (isQuantity(field)) {
    const value = parsed.columns[field.column] as number | null;
    if (field.column === "qty_min" && value === null) throw invalid("A tier needs a starting quantity.");
    const capabilityId = await store.capabilityOfTier(edit.id);
    if (!capabilityId) throw new AppError("not_found", "That row does not exist.");
    const key = field.column === "qty_min" ? "qtyMin" : "qtyMax";
    await checkLadder(store, capabilityId, (tiers) => tiers.map((t) => (t.id === edit.id ? { ...t, [key]: value } : t)));
  }
  await store.update(field.table, edit.id, parsed.columns, actor);
  return field;
}

export interface TierInput {
  readonly capabilityId: string;
  readonly qtyMin: number;
  readonly qtyMax: number | null;
}

export const NEW_TIER_LABEL = "Added by a platform admin, prices not set";

/** Adds an empty tier (no prices) to a capability's ladder, if the ladder stays whole. */
export async function addTier(store: FactoryStore, actor: string, input: TierInput): Promise<void> {
  if (input.qtyMax !== null && input.qtyMax < input.qtyMin) throw invalid("The upper quantity is below the lower one.");
  const fresh: PriceTier = {
    id: "new",
    capabilityId: input.capabilityId,
    qtyMin: input.qtyMin,
    qtyMax: input.qtyMax,
    cost: null,
    sellGbpMinor: null,
    sellAudMinor: null,
    personalisationCostMinor: null,
    ruleId: GAP_RULE_ID,
    label: NEW_TIER_LABEL,
  };
  await checkLadder(store, input.capabilityId, (tiers) => [...tiers, fresh]);
  await store.addTier({ ...input, label: NEW_TIER_LABEL }, actor);
}
