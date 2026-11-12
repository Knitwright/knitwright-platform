import { checklistSentence, findingsOf, preExportCheck, whyNotClear } from "@/lib/compliance/checklist";
import { subjectFromTechPack } from "@/lib/compliance/from-techpack";
import { subjectForOrder } from "@/lib/compliance/from-order";
import type { DestinationLabel } from "@/lib/compliance/labels";
import type { ChecklistResult, ModerationState, ProductionClass } from "@/lib/compliance/model";
import type { TechPack } from "@/lib/techpack/types";

/**
 * The F-G2 pre-export checklist at the moment of ordering (plan v6 D1, decision 0132). Spec F-G2: "a deterministic
 * checklist before export or order". `subjectForOrder` was written for exactly this in plan v5 Z8 and nothing
 * called it; every order path now does, through `checklistForOrder`, over the same tech pack the Review tab reads.
 *
 * THE ONE SETTING. **False: the checklist runs at every order and its findings travel with the order to ops as
 * flags, but they do not refuse it.** Today nearly every item fails for reasons only the owner's data can clear:
 * no colour difference is agreed with any factory (owner decision 15), the care symbols are the ISO 3758
 * categories with no symbol transcribed (owner question ISO 3758), and the points of measure wait for the
 * factory's pattern master. Refusing on those would stop every order on the platform for want of data nobody on
 * a brand can give, and the plan's rule is that missing owner input never blocks. Owner question D1-2 of decision
 * 0132 asks when to turn it to true; that is one line here, and `order-checks.test.ts` holds both answers.
 *
 * The validation of the version itself is not softened by this: its blockers always refuse
 * (`lib/validation/order-gate.ts`), and so do moderation and the Class B review (`guardOrder`).
 */
export const CHECKLIST_REFUSES_ORDER = false;

/** A note an order carries to ops, as `brand_runs.flags` holds it. */
export type OrderFlag = Readonly<{ code: string; text: string }>;

/** What the order knows that the tech pack does not. */
export interface OrderChecklistFacts {
  readonly labels: readonly DestinationLabel[];
  readonly productionClass: ProductionClass;
  /** True once a person has allowed a Class B run; null when nobody has been asked. */
  readonly humanAllowed: boolean | null;
  /** The screen just before the order, as `guardOrder` returned it. */
  readonly moderation: ModerationState;
  /** The colour difference the factory agreed for this article. Null: none agreed. */
  readonly colourToleranceMax: number | null;
}

/** The one checklist over the version's tech pack, with what the order itself knows laid over it. */
export function checklistForOrder(pack: TechPack, facts: OrderChecklistFacts): ChecklistResult {
  const document = subjectFromTechPack(pack, facts);
  return preExportCheck(
    subjectForOrder(document, { labels: facts.labels, productionClass: facts.productionClass, humanAllowed: facts.humanAllowed, moderation: facts.moderation }),
  );
}

/** How many findings ride along by name. The rest are counted in the first flag; the stored flags stay small. */
export const MOST_CARRIED = 6;
const TEXT_MAX = 300;

export type ChecklistVerdict = Readonly<{ status: "go"; flags: readonly OrderFlag[] }> | Readonly<{ status: "refused"; message: string }>;

/** What the order does with the checklist: refuse on a blocker (only when the setting says so) or carry it. */
export function checklistAtOrder(result: ChecklistResult, refuses: boolean = CHECKLIST_REFUSES_ORDER): ChecklistVerdict {
  const why = whyNotClear(result);
  if (refuses && why !== null) return { status: "refused", message: `${checklistSentence(result)} ${why}` };
  const named = findingsOf(result)
    .slice(0, MOST_CARRIED)
    .map((found) => ({ code: `pre_export_${found.code}`, text: `${found.severity === "blocker" ? "Open" : "Note"}: ${found.message}`.slice(0, TEXT_MAX) }));
  return { status: "go", flags: [{ code: "pre_export_check", text: checklistSentence(result) }, ...named] };
}
