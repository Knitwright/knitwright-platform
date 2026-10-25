# 0051: Credits wired into outputs

Status: Proposed (charging is off by default; the numbers are still placeholders)
Date: 2026-10-26
Plan step: plans/platform-v4.md, workstream W2-E. Builds on 0044 (ledger) and 0039 (validation and status).

## Context

Decision 0044 shipped the credit ledger and deliberately gated nothing. The spec makes marketing media, the full
tech pack PDF and pattern files cost credits, and returns the credits of a design when it is ordered.

## Decision

1. **`withCredits(config, handler)`** (`lib/credits-gate`) wraps a `defineRoute` handler. It works out the output kind and
   the design version, spends through `spendCredits` (idempotent on brand, kind and version), and only then runs the
   handler. A short balance stops the request with a plain message that names the price and the balance
   (a `conflict`, HTTP 409; no 402 exists in the route framework). The message says when the price is a placeholder.
2. **Flag `CREDITS_ENFORCED`, off by default** (exactly the text `true` turns it on, like `SHOW_3D`). Off, the wrapper
   reads no version, touches no database, and writes one info log line: what the output would have cost. It does NOT
   record to the ledger: a ledger line is a real spend, and a "pretend" kind would need the reserved migration
   `20261026050000_credit_hooks.sql`, which was not needed. The log is the record.
3. **Wired routes (one wrapper each, handler body unchanged):**
   | Route | Kind | Free cases |
   |---|---|---|
   | `GET /api/projects/[id]/exports/pdf` | `techpack_pdf` | `xlsx` and `svg` exports, and the tech pack page, stay free |
   | `GET /api/projects/[id]/print-files` | `pattern_file` | |
   | `POST /api/projects/[id]/patterns` | `pattern_file` | not charged while patterns are unavailable |
   | `POST /api/projects/[id]/images` | `marketing_media` | |
   Not wired: `GET /api/pattern-library/[blockId]/dxf` (a library block is not a design version) and the ops batch
   print files (a factory action).
4. **The design version hash** is `designVersionHash(projectId, version)` (`lib/credits/version-hash.ts`), a SHA-256 of
   those two, so the charge and the refund agree without a lookup. Re-downloading the same version is free, and a new
   saved version is a new charge.
5. **Charge first, retry free.** The charge is made before the work, so a short balance stops a paid model call before
   it starts. If the work then fails, a retry of the same version is already paid. The photoreal charge carries the
   metered call's `usage_events` id, which joins the credit line to the cap record (0044, point 1). A refused charge
   throws inside the handler, so `defineRoute` gives back the photoreal reservation.
6. **What the member sees.** A file answer carries `x-credits-price`, `x-credits-charged` and `x-credits-balance`; a JSON answer
   carries a `credits` object, only when enforcement is on. `PriceNote` shows the price and the balance under each paid
   button and shows nothing when enforcement is off. It reads `GET /api/credits` (which now says `enforced`) on mount and
   when the window is focused, so the balance after a spend appears when the member returns to the page, not at once.
7. **Refund on order.** `orderDesignVersion` (`lib/credits-gate/server.ts`) calls V1's `writeDesignStatus(..., "ordered")`
   and then `refundForOrder` for the same version. If the status move is refused nothing is refunded; if the refund
   fails the order stands and the failure is logged (calling `refundForOrder` again is safe, the database refunds a
   spend once). **Nothing calls it yet**: the order flow (V5, the Store) is not built. V1's files are not edited.
8. **No migration and no new dependency.**

## Not verified

- The sandbox this was written in has no Docker, so no database test, no `pnpm build` and no end-to-end spec was run
  here; CI is their first run. The route tests replace `defineRoute` and the database with stand-ins, so they show what the
  gate does around each handler, not that the real framework, session and ledger work together with the flag on.
- With the flag on, the full path (real ledger, real route) has not been run by anyone.
- With the flag off, the only change in a route is the wrapper that logs one line; `PriceNote` makes one extra
  `GET /api/credits` read on the pages that have a paid button.

## Alternatives

- **Charge after the file.** No credit is lost to a failure, but two requests can both be served before the second spend
  is refused, and a paid model call would have started without a credit. Rejected for the photoreal route in particular.
- **A "would have spent" ledger kind.** Needs a migration and pollutes the balance sum. Logged instead.

## Owner questions

See `apps/web/lib/credits/OWNER-QUESTIONS.md`, items 8 to 11, and the earlier items 1 to 7.
