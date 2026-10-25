# 0056: Platform settings console

Status: Proposed
Date: 2026-10-27
Plan step: plans/platform-v4.md, workstream W3-F. Answers are collected in `docs/owner/questionnaire-2026-10-25.md`.

## Context

Waves 1 and 2 left labelled placeholders in code: the ops cut-off, the guardrail dpi, bleed and safe zone, the credit
prices and allowance, and a factory profile with every term "not set". Changing one meant a deploy. The owner's answers
to the questionnaire should be entered by a platform admin, with a record of who and when.

## Decision

1. **Two tables** (`20261027020000_platform_settings.sql`): `platform_settings` (one row per key: value, set_by, set_at)
   and `platform_settings_history` (append-only: update, delete and truncate are refused by trigger). RLS is on with no
   policy, and no browser role holds any privilege; the server's key holds SELECT only. Writes go through
   `platform_setting_set(actor, key, value)`, executable by the server's key only, which answers "not found"
   (`P0002`) unless the actor is in `platform_admins`, upserts the row and writes the history line in one step. A null
   value removes the row (back to the default) and is recorded.
2. **A registry** (`lib/settings/registry.ts`) lists every key with a Zod schema, the in-code default, a label and the
   questionnaire question it answers. An unknown key is refused. Other workstreams add entries in
   `lib/settings/extensions.ts` (W3-C registers its checker thresholds there, group `checker`). **No secret or API key
   is a setting**; a test fails if a key or label mentions one.
3. **Read-through, by module:**
   | Module | How the stored value reaches it |
   |---|---|
   | Credits | `createCreditsService` takes an optional `readSettings`; `creditsService()` passes `loadCreditSettings`. `syncCreditPrices` (existing) writes the merged prices to `credit_prices`; the allowance is read at each grant. Prices stop being flagged placeholders only when all three are set. |
   | Ops | Written through to the existing `ops_settings` row (`ops_update_settings`), with the label "Set by <admin> on <date>". Every existing reader (ops pages, factory sheet, metrics) is unchanged. |
   | Factory profile | Written through to the seeded `factory_profiles` row. `loadFactoryProfile` for the default id lays that row over the registry-built default; while the row carries the default label (or cannot be read) the result is exactly what it was. |
   | Guardrails | `loadGuardrailSettings(admin)` returns the defaults with stored values laid over. See "Not done". |
   With nothing stored, each module returns exactly its old value; unit tests assert this for each.
4. **UI** `/admin/settings`: grouped sections, plain-language labels, one form per setting with Save and "Use the
   Knitwright default", errors in words from the same schema, and per setting a source line ("Set by <address> on
   <date>" or "Knitwright default, not agreed with a factory") and a history list. Platform admins only; everyone else
   gets the 404 the ops and leads pages give (`requirePlatformAdmin`).
5. Nothing here sells or charges anything.

## Honest limits

- **Not done: guardrail callers.** `loadGuardrailSettings` exists and is tested, but the checks that default to
  `DEFAULT_SETTINGS` (`lib/variants/generate.ts`, `lib/panel-layers/guardrail-input.ts`) are other workstreams' files and
  take it synchronously; they still use the defaults until a later change passes the loaded value in.
- **Guardrail label.** A guardrail value set here is marked source `print-house` because the type has only that and the
  default. It means "set by the owner's side", not "measured at a print house".
- **Time zone.** The ops cut-off is entered in UTC (12:00 Pakistan time is 07:00 UTC); there is no zone field.
- **Lead time per article.** The factory profile schema has one lead time, so one is what the console sets.
- **Media daily cap.** The key is stored and shown, but no media code reads it yet (W3-A/W3-B own that). It starts as "not set".
- **Ops write-through overwrites.** Setting any ops value rewrites the whole `ops_settings` row from defaults plus
  stored values, so a lead time typed on `/ops/settings` before is replaced by the default unless it is also set here.
- Reset of a credit price re-syncs `credit_prices` to the placeholder; `credit_prices` rows have no history of their own,
  `platform_settings_history` is the record.
- Names shown are sign-in addresses; there is no display name for an admin.

## Owner questions

1. Should the ops cut-off take a time zone instead of UTC (question 6 says Pakistan time)?
2. May `/ops/settings` be removed in favour of this screen, so there is one place to change the cut-off?
3. Should a setting change need a reason, like an ops delay does?
