import type { OutputKind } from "@/lib/credits/kinds";
import { designVersionHash } from "@/lib/credits/version-hash";
import { AppError } from "@/lib/server/core/errors";
import type { Gate } from "./gate";

/** What a route handler's context must carry for a charge: who pays and the metered call, if any. */
export type PayingContext = Readonly<{
  session: Readonly<{ userId: string; brand: Readonly<{ id: string }> }>;
  usage?: Readonly<{ eventId: string }> | null;
}>;

export type CreditConfig<C> = Readonly<{
  /** What is made, or null when this request makes something free (so no charge). */
  kind: OutputKind | ((context: C) => OutputKind | null);
  /**
   * The design version the output is made from, or null when it cannot be known (the request is
   * invalid and the handler will refuse it). Called only when enforcement is on.
   */
  version: (context: C) => Promise<Readonly<{ projectId: string; version: number }> | null>;
  /** The route, for the log. */
  where: string;
}>;

const withHeaders = (response: Response, headers: Record<string, string>): Response => {
  const next = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) next.headers.set(name, value);
  return next;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/**
 * Wraps a route handler so the output it makes is charged to the brand once per output kind and
 * design version. With enforcement off the handler runs exactly as before. The charge is made
 * before the handler: a failed attempt is retried free, because the same version is already
 * charged, and a short balance stops the work before any model or file is made.
 */
export const createWithCredits =
  (gate: Gate) =>
  <C extends PayingContext, T>(config: CreditConfig<C>, handler: (context: C) => Promise<T | Response>) =>
  async (context: C): Promise<T | Response> => {
    const kind = typeof config.kind === "function" ? config.kind(context) : config.kind;
    const base = { brandId: context.session.brand.id, userId: context.session.userId, where: config.where };
    if (kind === null) return handler(context);
    const enforced = gate.enforced();
    if (!enforced) {
      // Off: the gate only logs what would have been spent. No version is read, so no extra query is made.
      await gate.check({ ...base, kind, designVersionHash: "not-read" });
      return handler(context);
    }
    const design = await config.version(context);
    if (design === null) return handler(context);
    const answer = await gate.check({
      ...base,
      kind,
      designVersionHash: designVersionHash(design.projectId, design.version),
      ...(context.usage ? { usageEventId: context.usage.eventId } : {}),
    });
    if (!answer.ok) throw new AppError("conflict", answer.message);
    const output = await handler(context);
    const note = answer.note;
    if (note === null) return output;
    if (output instanceof Response) {
      return withHeaders(output, {
        "x-credits-price": String(note.price),
        "x-credits-charged": String(note.charged),
        "x-credits-balance": String(note.balance),
      });
    }
    return isPlainObject(output) ? ({ ...output, credits: note } as T) : output;
  };
