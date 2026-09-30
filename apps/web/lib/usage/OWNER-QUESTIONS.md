# Owner questions: usage metering (plan step 10)

1. **Allowance amounts.** The defaults below are provisional, chosen only to be above one
   design session at mid-tier prices (plan cost table: about $0.17). Set the real ones with
   the `USAGE_*` variables (microdollars; 1,000,000 = $1) or per user or brand with
   `usage_set_limit`.

   | Allowance | Default |
   |---|---|
   | User, text and image reading (`ai`), a month | $7.50 |
   | Brand, `ai`, a month | $30.00 |
   | User, photoreal images, a month | $15.00 |
   | Brand, photoreal images, a month | $60.00 |
   | Safety ceiling, everyone together, a UTC day | $25.00 |

   The monthly defaults are 30 times the earlier daily ones, so the same average use fits.

2. **Alert channel.** At half and at full ceiling a warning is written to the server log.
   No email provider is set up yet. Where should the alert go (email via Resend, Sentry)?
3. **Day or month.** Allowances reset at midnight UTC every day. Is a monthly allowance
   wanted once pricing exists? **Answered 2026-09-30: monthly.** Built: a user's and a brand's
   allowances start again at midnight UTC on the first of each calendar month (migration
   `20260930050000_monthly_allowances.sql`, `lib/usage/period.ts`; variables renamed
   `USAGE_*_MONTHLY_*`). The safety ceiling across everyone stays per UTC day, as a guard
   against a runaway spend, and the cost of one call is limited as before.
4. **Per-call cost estimates** are set by steps 12 to 14, when the models are chosen.
