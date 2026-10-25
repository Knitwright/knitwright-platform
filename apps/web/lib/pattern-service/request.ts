import type { BlockView } from "@/lib/pattern-library/records";
import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import { eligibleForPatternService } from "./eligibility";
import { quoteWords, type Quote } from "./quote";
import type { Created, NewRequest } from "./service";
import { buildSnapshot, snapshotHash } from "./snapshot";

export type DesignRead = Readonly<{ name: string; garmentType: string; currentVersion: number; spec: unknown }>;

/** Everything the request reads or writes, passed in so the rules can be tested without a database. */
export type RequestDeps = Readonly<{
  design: (brandId: string, projectId: string) => Promise<DesignRead>;
  blocks: (brandId: string) => Promise<readonly BlockView[]>;
  quote: () => Promise<Quote>;
  /** The owner's credits flag (decision 0051). Off by default: a priced request then records what it would have cost and charges nothing. */
  creditsEnforced: () => boolean;
  ensureAllowance: (brandId: string) => Promise<void>;
  create: (input: NewRequest) => Promise<Created>;
  log: (event: LogEvent) => void;
}>;

export type RequestedPattern = Created & Readonly<{ quote: Quote; snapshotHash: string }>;

/**
 * Sends the design's current version to the pattern service. The price and the turnaround are copied from the settings now and kept
 * with the request. Credits are taken only when a price is set (and above 0) and the credits flag is on.
 */
export async function requestPattern(deps: RequestDeps, who: Readonly<{ brandId: string; userId: string }>, projectId: string): Promise<RequestedPattern> {
  const design = await deps.design(who.brandId, projectId);
  const eligible = eligibleForPatternService(design.garmentType, await deps.blocks(who.brandId));
  if (!eligible.ok) throw new AppError("conflict", eligible.reason);

  const quote = await deps.quote();
  const snapshot = buildSnapshot({ projectId, version: design.currentVersion, garmentType: design.garmentType, name: design.name, spec: design.spec });
  const hash = snapshotHash(snapshot);
  const priced = quote.priceCredits !== null && quote.priceCredits > 0;
  const charge = priced && deps.creditsEnforced();
  if (charge) await deps.ensureAllowance(who.brandId);
  if (priced && !charge) {
    deps.log({ level: "info", message: `Credits not enforced: a pattern request would have cost ${quoteWords(quote).price}`, where: "pattern-service" });
  }

  const created = await deps.create({
    brandId: who.brandId,
    userId: who.userId,
    projectId,
    designVersion: design.currentVersion,
    articleId: design.garmentType,
    snapshot,
    snapshotHash: hash,
    quote,
    charge,
  });
  return { ...created, quote, snapshotHash: hash };
}
