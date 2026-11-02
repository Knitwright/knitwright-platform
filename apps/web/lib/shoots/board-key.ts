import { createHash } from "node:crypto";
import type { ShootBoardSettings } from "./board";

/**
 * THE NAME A SHOOT'S CREDIT LINE GOES UNDER (H2 of the v5 security review, decision 0116).
 *
 * This is deliberately not in `board.ts`. The ledger key is a digest, `node:crypto` is a Node
 * builtin, and three client components import `lib/shoots/index.ts`, which re-exports `./board`.
 * So the key lives in its own module that the barrel does not re-export, exactly as `provider.ts`,
 * `run.ts` and `service.ts` do -- `tests/architecture/client-weight.test.ts` fails the build if any
 * client component reaches a Node builtin, however many hops away.
 *
 * It was a prefix of the settings before, cut to 200 characters to fit the ledger's own check on
 * `p_output_key` (migration 20261201030000). The prefix is about 120 to 170 characters of board id
 * and short fields, so most of the prompt was thrown away and all of it was once `backgroundText`
 * was long. Two runs whose prompts differed only past that cut shared a key, and the ledger, doing
 * exactly what it is asked, charged the first and let every later one through free.
 *
 * The digest is of the whole thing, so nothing is discarded and nothing can be padded out of it.
 * `credit_spend_output` keys the same way and says why in its own comment.
 */

/**
 * The settings as one unambiguous string: object keys in sorted order, every scalar through
 * `JSON.stringify`, so no two different settings can be written the same way and a field a later
 * release adds is in the key the day it is added rather than the day somebody remembers it.
 */
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([one], [two]) => one.localeCompare(two));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stable(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

/**
 * A key for the credit ledger: one per board and per set of settings, so pressing Regenerate on an
 * unchanged board does not charge twice and changing any setting does charge again.
 *
 * **The automatic second attempt is not in the key on purpose.** F-L1 says a result the checker
 * turns away is generated again once; the person asked for one picture and pays for one, so the
 * retry runs on the same key and cannot charge a second time. The platform's own spend is metered
 * per model call either way (`run.ts`), because that money is really spent.
 */
export function idempotencyKeyOf(boardId: string, settings: ShootBoardSettings): string {
  const digest = createHash("sha256").update(stable({ boardId, settings }), "utf8").digest("hex");
  return `shoot:${digest}`;
}
