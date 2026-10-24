# 0044: Credits ledger

Status: Accepted (the numbers are placeholders; see Owner questions)
Date: 2026-10-24
Plan step: plans/platform-v4.md, workstream V6

## Context

The product spec makes designing, saved versions, 3D views, the team store hand-off and the tech
pack summary free, and charges credits for marketing media, the full tech pack PDF and pattern
files. Credits spent on a design come back when that design is ordered. The beta usage caps
(decision 0012) already limit what Knitwright pays for AI calls, per user and per brand. The owner
has not set any price or allowance.

## Decision

1. **Credits and caps are separate and both stay.** A cap protects cost: microdollars Knitwright
   pays a vendor, reserved before a paid call. Credits are the product's currency: what a brand
   spends. A brand can be under its cap and out of credits, or the reverse. A credit spend that pays
   for a metered call stores that call's `usage_events` id on its ledger line
   (`credit_ledger.usage_event_id`, no foreign key), so the two records join. A credit spend does not
   itself reserve usage: an export with no model call (the tech pack PDF) has no vendor cost to cap,
   and a model call is reserved by `defineRoute`'s `cost` as before. Wave 2 wires the two together.
2. **`credit_ledger` is append-only.** One line per grant, spend, refund or expiry, with a signed
   amount. The balance is the sum, computed (`credit_balance`), never stored. Update, delete and
   truncate are refused by a trigger, like saved design versions; the delete is let through only
   when the brand itself is deleted, so account deletion still works. The grants stop every browser
   role and the server's own key from writing directly.
3. **Only functions write**, run by the server's own key: `credit_grant`, `credit_ensure_allowance`,
   `credit_spend`, `credit_refund_for_order`, `credit_expire`, `credit_set_prices`. Each takes the
   brand's advisory lock for the transaction, so two spends cannot read the same balance and the
   balance never goes below zero.
4. **Idempotent spend.** The key is `spend:<output kind>:<design version hash>`, unique per brand. Asking
   again for the same output of the same version costs nothing, which is what makes a re-download free.
5. **Refund once.** `credit_refund_for_order(brand, version hash)` writes one refund line per
   unrefunded spend on that version. A refund names its spend (`refund_of`, unique), so a second call,
   or two at once, refunds nothing more. V1 owns the move to "ordered" and V5 the order; they call
   `refundForOrder` from `lib/credits/service.ts`. Nothing calls it yet.
6. **Prices** live in `credit_prices` (output kind to credits, with an `is_placeholder` flag). One
   settings file, `lib/credits/settings.ts`, is the single source of the numbers. The migration seeds the
   same values and a unit test fails if they differ; `syncCreditPrices` writes the file's values to the
   database after the owner changes them. **Every number is a placeholder, labelled as such on the
   credits page.**
7. **Monthly allowance.** The brand's free credits for a UTC month are one grant with the key
   `allowance:YYYY-MM`, so they are given once. They reuse the month boundary of the AI allowances
   (`allowanceMonth` in `lib/usage/period.ts`; there is no `monthly_allowances` table, the monthly
   allowance is `usage_limits.monthly_allowance` and its configured defaults, which count microdollars
   and so cannot be reused for credits). The grant is made lazily when the brand reads its credits (the
   chip or the page), so no scheduled job is needed.
8. **Nothing is gated.** No existing export checks or spends credits. This ships the ledger, the prices,
   the balance chip in the studio header and the credits page. There is deliberately no route that
   spends credits.
9. **No new dependency.**

## Evidence

- `tests/integration/credits.test.ts` (database): idempotent spend under 8 parallel calls, no overspend
  under 6 parallel spends, refund once (including three at once), refund limited to the brand and the
  version, allowance once a month, append-only, no direct writes, row level security.
- `lib/credits/model.test.ts`: fast-check properties on a pure model of the same rules (balance equals
  the sum of lines and is never negative; no spend refunded twice; repeating spends changes nothing).
- Unit tests for the settings, the ledger helpers, the service, and that the migration's seed equals the
  settings file. `e2e/credits.spec.ts` covers the page and the chip.
- **Not verified here:** the cloud sandbox this was written in has no Docker, so `pnpm db:start`,
  `pnpm test:db` and `pnpm e2e` could not be run by the author. The migration was run against a plain
  PostgreSQL 16 with stubbed `auth`, `brands` and membership functions, and a hand-written scenario of
  allowance, spend, repeat, short balance, refund twice, update, delete, truncate and brand delete behaved
  as intended. CI runs the real suites.

## Alternatives

- **A stored balance column**: needs a second place to keep correct and can drift. A sum over one
  brand's lines is small and indexed.
- **Letting the ledger rows be corrected by reversal lines only**: this is what refund and expire are;
  there is no "adjustment" kind until the owner needs one.
- **Reserving through `usage_reserve`**: its units are microdollars of vendor cost against caps, which
  is a different quantity; mixing them would make a cap block a credit spend or the reverse.
- **A spend route**: a browser could spend credits without receiving anything. Spends belong inside the
  export that earns them.

## Consequences

- The balance chip makes one small database write-or-skip on each studio page. It is a no-op after the
  first read of the month, and a failed read shows nothing instead of breaking the page.
- A design version that was spent on and then refunded stays free to download again, because the spend
  line still exists: ordering a design leaves its outputs free. Whether that is intended is an owner
  question.
- Revisit when the owner sets prices, when exports are gated (wave 2), and if credits are ever sold
  (that belongs to the Store, which is out of scope here).

## Owner questions

See `apps/web/lib/credits/OWNER-QUESTIONS.md`.
