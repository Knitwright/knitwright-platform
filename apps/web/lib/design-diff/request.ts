import type { GarmentSpec, SpecAction } from "@/lib/garment";
import type { TextModelProvider } from "@/lib/providers/text-model";
import type { FactoryProfile } from "@/lib/validation";
import { diffFromText } from "./propose";
import { previewDiff, type GuardrailRun } from "./preview";

/** What the browser is sent for one request. Nothing is saved to make it. */
export type DiffAnswer =
  | {
      readonly kind: "preview";
      /** Signed by the server; handed back to apply the change as the next version. */
      readonly token: string;
      readonly changes: readonly string[];
      readonly warnings: readonly string[];
      /** Drawings of the front before and after, as picture addresses, or null when there is none. */
      readonly before: string | null;
      readonly after: string | null;
    }
  | { readonly kind: "refused"; readonly reason: string };

export const NOT_SWITCHED_ON = "The assistant is not switched on yet, so it cannot read that. Nothing was changed.";
export const FAILED = "The assistant could not answer just now. Nothing was changed. Try again in a moment.";

export interface DiffRequestDeps {
  readonly spec: GarmentSpec;
  readonly provider: TextModelProvider | null;
  readonly profile: FactoryProfile;
  readonly guardrails?: GuardrailRun;
  readonly sign: (actions: readonly SpecAction[], explanations: readonly string[]) => string;
  /** The front drawing of a design as a picture address. */
  readonly draw: (spec: GarmentSpec) => string | null;
  /** Gives the reserved cost back. Called when no model answered. */
  readonly refund: () => Promise<void>;
  readonly signal?: () => AbortSignal | undefined;
}

/** Words to a previewed, signed diff, or a plain reason. Never throws. */
export async function diffRequest(utterance: string, deps: DiffRequestDeps): Promise<DiffAnswer> {
  if (!deps.provider) {
    await deps.refund();
    return { kind: "refused", reason: NOT_SWITCHED_ON };
  }
  let proposed: Awaited<ReturnType<typeof diffFromText>>;
  try {
    proposed = await diffFromText(utterance, deps.spec, deps.provider, deps.signal?.());
  } catch {
    await deps.refund();
    return { kind: "refused", reason: FAILED };
  }
  if (!proposed.ok) return { kind: "refused", reason: proposed.reason };
  const preview = previewDiff(deps.spec, proposed.diff, deps.profile, deps.guardrails);
  if (!preview.ok) return { kind: "refused", reason: preview.reason };
  return {
    kind: "preview",
    token: deps.sign(preview.actions, preview.changes),
    changes: preview.changes,
    warnings: preview.warnings,
    before: deps.draw(deps.spec),
    after: deps.draw(preview.after),
  };
}
