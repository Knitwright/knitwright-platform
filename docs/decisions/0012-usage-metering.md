# 0012: Usage metering and caps

Status: Accepted. Amended 2026-09-30: allowances are monthly (owner decision). The allowance amounts wait for the owner.
Date: 2026-09-29
Plan step: 10

## Context

No paid AI call exists yet; steps 12 to 15 add them. Public sign-up makes accounts and
brands free to create, so a cap per brand alone can be reset by making another brand.
Acceptance criterion M6: spend per user, per brand and in total is capped, and the cap holds
under parallel requests.

## Decision

1. **Unit of account: the microdollar**, a whole millionth of a US dollar, estimated before
   each call. A cheap text call costs a fraction of a cent, so whole cents would round it to
   nothing. Vendors bill in US dollars.
2. **Two allowances, each per user and per brand, per calendar month in UTC** (per UTC day
   until the owner's decision of 2026-09-30; migration `20260930050000_monthly_allowances.sql`): `ai` (text and image
   reading) and `photoreal` (generated pictures). A call draws from one of them. The safety
   ceiling counts both, across everyone. Defaults come from configuration
   (`USAGE_*` variables in `lib/config/env.ts`); a row in `usage_limits` replaces the default
   for one user or one brand. The safety ceiling stays per UTC day: it guards against a runaway
   spend, and a day limits the damage of a leaked account faster than a month.
3. **`usage_reserve` in Postgres** keeps three running totals (user and brand for the month,
   everyone for the day) in
   `private.usage_counters`. It locks the three rows in a fixed order, then makes one
   conditional update that moves all three or none. Refusal names the first limit passed.
   `usage_refund` gives a failed call's cost back once. `usage_set_limit` sets or removes an
   allowance. All three are security-definer functions only the server's key may run.
4. **Tables `usage_events` and `usage_limits` have no write policy and no write grant for
   any client role.** Members read their brand's events and limits, and their own limits.
5. **Ceiling alerts at half and at full.** The database records each alert once a day for each
   ceiling, and the reservation returns the ones it raised. The app hands them to a
   `UsageAlert`. No email provider exists yet, so the only implementation writes a warning to
   the server log.
6. **`defineRoute` takes `cost`** (fixed, or worked out from the validated input). It is
   allowed only on member routes, reserved after the input is validated and before the
   handler runs, and refunded if the handler throws. Over a user or brand allowance the route
   answers 429 `over_allowance`; over the ceiling, 503 `unavailable`. A meter that cannot
   answer stops the call (500): no call runs unmetered.

## Evidence

`tests/integration/usage.test.ts`: 100 parallel reservations against an allowance of 10
succeed exactly 10 times; each limit, the photoreal split, overrides, refunds, alerts, and
refusal to browsers. The isolation suite covers both tables (a member cannot change a limit
or delete an event). Unit tests cover the meter, the alert and the route option.

## Alternatives

- Three separate conditional updates with a rollback on the first refusal: the same result,
  but harder to read as one step.
- A counter per brand only: reset by making a new brand. Rejected by the plan.
- Daily allowances (the first version): a day limits the damage of a leaked account faster,
  but the owner chose monthly allowances on 2026-09-30, closer to billing. The daily safety
  ceiling keeps the fast limit on damage.
- Counting from `usage_events` with `sum()`: needs a lock on a whole range and grows with
  use. Running totals are one row each.

## Consequences

- Every metered call serialises briefly on the day's global row. Fine for the MVP's volume;
  shard the global counter if contention is ever measured.
- The cost is an estimate. Settling the true cost after the call is not done; steps 12 to 14
  set the estimates.
- A refund only happens when the handler throws. A handler that catches its own failure and
  answers normally keeps the cost.
- Revisit when an email provider is added (the alert), or when the owner sets pricing.
