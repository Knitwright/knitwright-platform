import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type ClubRole } from "@/lib/clubs/roles";
import { NOT_ALLOWED } from "@/lib/clubs/errors";
import { guardOrder, type OrderGuards } from "@/lib/moderation/before-order";
import type { OrderValidationGate } from "@/lib/make/order-gate";
import { AppError } from "@/lib/server/core/errors";
import { moderationTargets } from "@/lib/validation/spec-input";
import { checkBreakdown, numbersOf } from "./breakdown";
import { loadRunContext } from "./run-context";
import type { RunBody } from "./schemas";
import { getProduct, submitRun, type SubmittedRun, type Who } from "./service";
import { canOrder, whyNotOrder } from "./stage";

type Clients = Readonly<{ client: SupabaseClient; admin: SupabaseClient }>;

export const UNKNOWN_FABRIC = "Choose one of the fabrics the factory lists.";
export const FLAGS_NOT_READ = "Read the notes about this quantity and tick the box to send it anyway.";

/** The order as it is handed on: to `submitRun` directly, or to checkout (plan v6 C1, decision 0152). */
export type RunToHand = Readonly<{
  productId: string;
  projectId: string;
  kind: "sample" | "run";
  releaseId: string;
  factoryProfileId: string;
  fabricKey: string;
  sizes: Readonly<Record<string, number>>;
  flags: readonly Readonly<{ code: string; text: string }>[];
  requestKey: string;
}>;

/**
 * Checks a size breakdown against the design's size run and the factory profile, then sends it to ops. A refusal is checked
 * here in plain words; the database checks the role, the stage and the release again. A flagged quantity (under the minimum,
 * over 300) goes only after the brand has said it read the notes. The factory comes from the profile, never from the request.
 *
 * `send` is where the checked order goes: the action hands it to checkout, so it reaches production only once paid
 * or invoiced (plan v6 C1, decision 0152). Without one it goes straight to `submitRun`, which the database then
 * refuses unless a payment names it.
 */
export async function placeOrder<T = SubmittedRun>(
  clients: Clients,
  who: Who,
  role: ClubRole,
  body: RunBody,
  guards: OrderGuards,
  gate: OrderValidationGate,
  send: (run: RunToHand) => Promise<T> = (run) => submitRun(clients.admin, who, run) as Promise<T>,
): Promise<T> {
  if (!can(role, "manageKit")) throw new AppError("forbidden", NOT_ALLOWED);
  const product = await getProduct(clients.client, who.brandId, body.productId);
  const refusal = whyNotOrder(product.stage, body.kind);
  if (!canOrder(product.stage, body.kind) && refusal) throw new AppError("conflict", refusal);

  const context = await loadRunContext(clients.client, who.brandId, product.projectId);
  // A profile with no fabrics listed lets the brand name one (the builder shows a text box then); a listed profile does not.
  if (context.fabrics.length > 0 && !context.fabrics.includes(body.fabricKey)) throw new AppError("invalid_input", UNKNOWN_FABRIC);
  const breakdown = checkBreakdown({ kind: body.kind, quantities: numbersOf(body.quantities), sizeRun: context.sizeRun, moq: context.moq });
  if (breakdown.errors.length > 0) throw new AppError("invalid_input", breakdown.errors.join(" "));
  if (breakdown.flags.length > 0 && !body.acknowledgeFlags) throw new AppError("conflict", FLAGS_NOT_READ);

  // The version's own checks first, then the screen before every order (spec F-G1; security review v5 H3,
  // decision 0116), then the F-G2 checklist (plan v6 D1, decision 0132). Last of the refusals, so a person
  // is told the cheap things first, and immediately before the one write.
  const checklist = await gate(
    { projectId: product.projectId, releaseId: body.releaseId, productionClass: context.productionClass, colourToleranceMax: null },
    async () =>
      (
        await guardOrder(guards, {
          releaseId: body.releaseId,
          label: context.designName,
          assetIds: moderationTargets(context.spec).map((target) => target.id),
          texts: [{ text: context.designName, context: "title" }],
          // A sample is never Class B here: the class is a property of a run, and a sample is part of
          // what the class is decided from. The make flow draws the same line.
          classB: body.kind === "run" && context.productionClass === "B",
        })
      ).result,
  );

  return send({
    productId: product.id,
    projectId: product.projectId,
    kind: body.kind,
    releaseId: body.releaseId,
    factoryProfileId: context.factoryProfileId,
    fabricKey: body.fabricKey,
    sizes: breakdown.sizes,
    flags: [...breakdown.flags, ...checklist],
    requestKey: body.requestKey,
  });
}
