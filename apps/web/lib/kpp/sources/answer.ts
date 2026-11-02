import type { CreditNote } from "@/lib/credits-gate/gate";
import { AppError } from "@/lib/server/core/errors";
import type { ExportResult } from "../export";
import type { GateIssue } from "../gate";

/**
 * What the export route answers with (plan v5 X5 item 6, decision 0070 revision 3). It is here, with tests, so
 * `sources/server.ts` is only reads and joining.
 *
 * A package that cannot be built is **not** an error on our side and never a bare 500: it is the F-G2 gate
 * saying what the factory still has to answer, and the member is told every one of those things in the gate's
 * own words. Nothing is softened and nothing is guessed, because a package built over a gap is a garment made
 * wrong.
 */

export const CANNOT_BUILD = "This production package cannot be built yet.";

/** Every gap the gate found, each in its own sentence, with the dotted path of the field it is about. */
export const gapLines = (issues: readonly GateIssue[]): readonly string[] => issues.map((issue) => `${issue.path}: ${issue.message} (${issue.ruleId})`);

/**
 * The refusal, as the route throws it. 409, because nothing about the request is wrong: the design and the
 * factory rows are simply not finished. A charge refusal carries the credits gate's own sentence instead.
 */
export function packageRefusal(result: Extract<ExportResult, { ok: false }>): AppError {
  if (result.reason === "refused") return new AppError("conflict", result.message);
  return new AppError("conflict", `${CANNOT_BUILD} ${result.issues.map((issue) => issue.message).join(" ")}`, { package: gapLines(result.issues) });
}

/** The credit headers `withCredits` would have put on the answer; none when nothing was charged. */
export const creditHeaders = (note: CreditNote | null): Readonly<Record<string, string>> =>
  note === null ? {} : { "x-credits-price": String(note.price), "x-credits-charged": String(note.charged), "x-credits-balance": String(note.balance) };

/** The ZIP, sent once and never stored. `no-store` because a package is built for one download. */
export function packageResponse(zip: Uint8Array, fileName: string, note: CreditNote | null): Response {
  return new Response(zip as Uint8Array<ArrayBuffer>, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-length": String(zip.byteLength),
      ...creditHeaders(note),
    },
  });
}
