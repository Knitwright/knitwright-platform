import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type ClubRole } from "@/lib/clubs/roles";
import { NOT_ALLOWED } from "@/lib/clubs/errors";
import { AppError } from "@/lib/server/core/errors";
import { checkBreakdown, numbersOf } from "./breakdown";
import { loadRunContext } from "./run-context";
import type { RunBody } from "./schemas";
import { getProduct, submitRun, type SubmittedRun, type Who } from "./service";
import { canOrder, whyNotOrder } from "./stage";

type Clients = Readonly<{ client: SupabaseClient; admin: SupabaseClient }>;

export const UNKNOWN_FABRIC = "Choose one of the fabrics the factory lists.";
export const FLAGS_NOT_READ = "Read the notes about this quantity and tick the box to send it anyway.";

/**
 * Checks a size breakdown against the design's size run and the factory profile, then sends it to ops. A refusal is checked
 * here in plain words; the database checks the role, the stage and the release again. A flagged quantity (under the minimum,
 * over 300) goes only after the brand has said it read the notes. The factory comes from the profile, never from the request.
 */
export async function placeOrder(clients: Clients, who: Who, role: ClubRole, body: RunBody): Promise<SubmittedRun> {
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

  return submitRun(clients.admin, who, {
    productId: product.id,
    kind: body.kind,
    releaseId: body.releaseId,
    factoryProfileId: context.factoryProfileId,
    fabricKey: body.fabricKey,
    sizes: breakdown.sizes,
    flags: breakdown.flags,
    requestKey: body.requestKey,
  });
}
