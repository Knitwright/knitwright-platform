# 0061: Designer templates and the royalty ledger (W4-B)

Status: Proposed. Built in plans/platform-v4.md, workstream W4-B.
Date: 2026-10-28

## Context

The spec has a designer role: designers build templates for clubs or brands and earn a royalty per unit ordered. Decision 0041
reserved a `designer` template source and switched it off. This change turns it on, with a review step, a rights statement and a
ledger. It pays nobody: no payout, no payment, no Stripe.

## Decision

1. **Opt-in profile.** `designer_profiles` (migration `20261028020000_designers.sql`): one row per person who opts in at `/designer`,
   with the name shown as attribution.
2. **Submissions.** `template_submissions` holds a frozen copy of the newest saved version of one of the designer's designs, with title,
   sport, style, colour family and status (draft, submitted, approved, rejected). The user text says "Live in the template library" and
   "Not accepted"; the stored value `approved` is never shown. Sending needs the rights statement ("I hold the rights to every artwork in
   this design"); a check constraint refuses `submitted` or `approved` without it, and the time it was made is stored. A platform admin
   may reject a draft or a submission, with a reason, without the statement. A rejected submission is not resent; the designer offers a new one.
3. **Review at `/admin/templates`** (platform admins; everyone else gets the page that does not exist). Accepting calls
   `template_submission_approve`, which adds a `templates` row with source `designer`, `designer_id` and the designer's name as `attribution`,
   review state `not_reviewed` (a factory review is a separate step). The library card says "By <name>, not reviewed by a factory".
   The check that switched the source off is replaced by one that requires a designer and an attribution for the `designer` source and neither otherwise.
4. **Which designs came from a designer template.** `createFromTemplate` now notes the use (`designer_record_use`) when the template's source is
   `designer`. `designer_template_uses` is server-only: no browser role reads it, so a designer never learns which brand used their work.
5. **Royalty ledger** (`royalty_accruals`, append-only: update, delete and truncate are refused; a line goes only with the designer's own account).
   An insert trigger on `ops_orders` calls `designer_accrue_for_order`, which adds one line per release (unique on `release_id` and on `order_id`, so a
   retry is harmless). The line holds the units (the order's pieces, a count; no names), the rate and the currency. The rate is read from the platform
   setting `designer.royalty_per_unit` (whole number, smallest unit of the order's currency; registered in `lib/settings/extensions.ts`, group
   "Designer royalties", questionnaire question 42). **Nothing is invented:** while the setting is not set, or the order carries no currency, the line
   counts the units and accrues 0, and a rate set later does not rewrite old lines. The trigger swallows its own errors into a warning, so a royalty
   fault can never stop an order. `lib/designers/royalty.ts` holds the same sum for display and tests.
6. **Payout state** is `designer_payout_events`, an append-only history of notes (not paid, on hold, paid) set by hand by a platform admin through
   `designer_set_payout_state`. It is a note; nothing moves money, and the screen says so.
7. **Dashboard** at `/designer`: submissions with status, templates live, units ordered, royalty accrued per currency, payout state, and a notice while no rate is set.
8. **Rights and privacy.** Designers read their own profile, submissions, ledger lines and payout notes through row security; ledger lines carry order and
   release ids but no brand, name or roster. Writes go through functions executable by the server's key only.

## Shared files touched (few lines each)

- `lib/templates/service.ts`, `filters.ts`, `components/templates/TemplateCard.tsx`: note the use, carry and show the attribution.
- `lib/settings/extensions.ts` (the setting) and `lib/settings/registry.ts` (one line in `GROUPS`: the group "Designer royalties").
- `components/shell/StudioNav.tsx`: one entry, "Designer". `vitest.config.mts`: `designers` in the 90% list.
- `tests/integration/isolation.test.ts`: the five new tables.

## Honest limits

- **Not run here:** the database and end-to-end tests could not run in the cloud sandbox (no Docker). The migration was applied to a bare Postgres 16 with stub
  tables and its rules were exercised by hand (accrual with and without a rate and currency, once per release, append-only, row security, grants, account deletion).
- The end-to-end test makes one designer template in the shared local database and deletes it afterwards; other specs that count the library could see it during that window.
- Units are the order's pieces. The release roster is not read; `ops_orders.pieces` is the same count.
- If recording a template's use fails after the design is made, the person sees an error although the design exists, and no royalty would be recorded for it.
- Orders that arrive before a design is linked to a template (none today) are not back-filled; `designer_accrue_for_order` can be run again by the server for one order.
- The currency comes from the order. An order without one (the Store gave no value) cannot accrue money even when a rate is set.

## Owner questions

1. What is the royalty per unit, and in which currency or currencies? Until set, nothing accrues. Is a flat rate per unit right, or should it depend on the article?
2. Should units that arrived while no rate was set accrue once a rate is set (today they do not)?
3. Who reviews designer submissions, and should a factory review be required before a designer template is shown?
4. May a designer withdraw a live template? Today only the Knitwright team can remove one, through the service client.
5. Is the rights statement wording right, and does it need a lawyer's text?
6. How and when will designers be paid, and who tracks it? This build only keeps a hand-written note.
