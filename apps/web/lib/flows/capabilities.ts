import { FILES_SERVICE_OPERATIONS, isPaid, type FilesServiceOperation } from "@/lib/files-service";
import type { BoardKind } from "@/lib/launch";
import { stubCapability } from "./stub";
import type { FlowCapability } from "./run";
import { FLOW_GAP_RULE } from "./types";

/**
 * What actually makes each board's picture, and who owns it.
 *
 * A flow runs boards; it does not draw any of them. Each kind of board belongs to another
 * workstream -- Mockup to L2, AI Image to L3, AI Video to L5, Marketing to L4, Info card to this
 * one -- so a flow asks a registry for the capability of a kind and uses a deterministic stub where
 * nothing is registered yet (plan v5, Lesson 9: an interface and a double, not an import from
 * another workstream's unmerged directory).
 *
 * **Where a paid call goes**, when one of those adapters lands: a capability that is model-based
 * goes through the files-service contract (X5, decision 0070) -- `render_garment`,
 * `transfer_design`, `composite_logo` are its paid operations -- and everything else goes through
 * the existing lifestyle adapters. Both are stubbed in tests, both are metered where the call is,
 * and neither is reached from this directory: `FILES_SERVICE_URL` is unset, every files-service
 * operation answers "not available".
 *
 * **The registry a real run uses is `real/registry.ts`** (decision 0133), built per run by
 * `real/server.ts` and required by `runFlowForBrand`. `EMPTY_REGISTRY` below is the engine's own
 * default for its tests, and nothing in production is handed it.
 */

/** The files-service operation a board kind's real capability would use, or null for one that is not its work. */
export const OPERATION_OF_KIND: Readonly<Record<BoardKind, FilesServiceOperation | null>> = {
  design: null,
  artboard: null,
  // A mockup is the garment rendered into a scene the platform owns.
  mockup: "render_garment",
  // An AI scene puts the drawn garment into a scene a model makes.
  ai_image: "transfer_design",
  // A clip is not a files-service operation: L5 picks a video model, configured in admin.
  ai_video: null,
  marketing: null,
  info_card: null,
};

export interface FlowCapabilityRegistry {
  /** The capability for a board kind, or nothing while that workstream has not landed. */
  readonly byKind: Partial<Readonly<Record<BoardKind, FlowCapability>>>;
  /** Says what is registered and what is still a stub, for the run panel's own note. */
  readonly note: string;
}

export const EMPTY_REGISTRY: FlowCapabilityRegistry = {
  byKind: {},
  note: "Every board is run by a deterministic stub: the mockup, AI scene, clip and marketing adapters are L2 to L5's and are not wired in yet. Nothing is charged and no model is called.",
};

/** The capability that will run a board of this kind. The stub, until its workstream lands. */
export const capabilityFor = (kind: BoardKind, registry: FlowCapabilityRegistry = EMPTY_REGISTRY): FlowCapability =>
  registry.byKind[kind] ?? stubCapability();

/** One capability that picks the right one per board, so the run engine asks only once. */
export const capabilityOf = (registry: FlowCapabilityRegistry = EMPTY_REGISTRY): FlowCapability => ({
  run: (request) => capabilityFor(request.kind, registry).run(request),
});

export interface CapabilityNote {
  readonly kind: BoardKind;
  readonly operation: FilesServiceOperation | null;
  /** True when the real capability would cost money, from the files-service's own list. */
  readonly paid: boolean;
  readonly stubbed: boolean;
  readonly ruleId: string;
}

/** What is wired and what is stubbed, per kind, for the decision record and the run panel. */
export function capabilityNotes(registry: FlowCapabilityRegistry = EMPTY_REGISTRY): readonly CapabilityNote[] {
  return (Object.keys(OPERATION_OF_KIND) as BoardKind[]).map((kind) => {
    const operation = OPERATION_OF_KIND[kind];
    return {
      kind,
      operation,
      paid: operation !== null && isPaid(operation),
      stubbed: registry.byKind[kind] === undefined,
      ruleId: FLOW_GAP_RULE,
    };
  });
}

/** Every operation this directory could ever ask the files service for. Nothing else. */
export const OPERATIONS_USED: readonly FilesServiceOperation[] = FILES_SERVICE_OPERATIONS.filter((operation) =>
  Object.values(OPERATION_OF_KIND).includes(operation),
);
