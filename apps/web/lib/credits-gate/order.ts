import { designVersionHash } from "@/lib/credits/version-hash";
import type { LogEvent } from "@/lib/server/core/guard";

type OrderDeps = Readonly<{
  /** Moves the version to "ordered" (lib/validation `writeDesignStatus`). Throws when the move is refused. */
  writeOrdered: () => Promise<void>;
  refundForOrder: (input: Readonly<{ brandId: string; designVersionHash: string }>) => Promise<Readonly<{ refunded: number }>>;
  log: (event: LogEvent) => void;
}>;

/**
 * Orders a design version and gives back every credit spent on it, once. For the order flow
 * (V5, the Store) to call. A version that cannot be ordered refunds nothing. If the refund itself
 * fails the order stands, the failure is logged and `refunded` is null: calling
 * `refundForOrder` again is safe because the database refunds each spend only once.
 */
export const orderVersion = async (
  deps: OrderDeps,
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  version: number,
): Promise<Readonly<{ refunded: number | null }>> => {
  await deps.writeOrdered();
  try {
    const { refunded } = await deps.refundForOrder({ brandId: who.brandId, designVersionHash: designVersionHash(projectId, version) });
    return { refunded };
  } catch (error) {
    deps.log({ level: "error", message: "Credits could not be given back for an ordered design", where: `order ${projectId} v${version}`, error });
    return { refunded: null };
  }
};
