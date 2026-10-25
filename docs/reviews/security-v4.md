# Security review of waves 1 to 4 (W5-A)

Reviewed 2026-10-25 at main `a30520a`. Scope: the platform only (not Store, `Sportswear/`, `kitwright/`, `supabase/config.toml`).
No paid model call was made. Method: every migration from `20261025010000` to `20261028040000` read in full; every route
handler and server action added in waves 1 to 4 traced to its database function; file serving, secrets and logging read;
`pnpm audit --prod --audit-level high` run. Findings were traced from the code, not run against a live database (no Docker in
the cloud sandbox); CI's integration tests are the check on the database side.

## Result

**No CRITICAL and no HIGH finding.** Nothing needed a fix with a failing-first test, so this PR changes no code. Every finding
below is MEDIUM or LOW and is **open**, listed so the owner can decide.

| Check | Result |
|---|---|
| `pnpm audit --prod --audit-level high` | No known vulnerabilities. |
| Dependencies added in waves 1 to 4 | One: `fabric` 7.4.0 (MIT), W2-G. |
| RLS on every table from waves 1 to 4 | All 43 new tables have it on; `isolation.test.ts` asserts this and that every table has an entry (`what exists`). No table is missing from its lists. |
| Table grants | Select only to `authenticated`; nothing to `anon`; `service_role` holds only what its functions need. No browser write grant anywhere. |
| SECURITY DEFINER functions | All set `search_path = ''`; all revoked from public, anon, authenticated; only `club_members`, `my_club_invitations`, `private.can_manage_members` are browser-callable, and the first two derive the caller from `auth.uid()`. |
| Routes and actions | All are `defineRoute` / `defineAction` output with a `LIMITS.*` rule (`rate-limits.test.ts`). Brand id always comes from the session, never from a body or parameter. Platform-only routes call `assertPlatformAdmin` / `opsContext` and answer "not found". |
| Watermark and unlock | Clean pictures live under `_private/<brand>/`, unreadable through storage RLS, with no `files` row, so no signed URL can be minted. `lib/media/serve.ts` re-reads the unlock state on every request. No API returns a clean path. No size or variant parameter. |
| Path traversal | Storage paths are `<session brand>/<kind>/<random uuid>.<ext>`; ids are UUID-validated. |
| Secrets | No `.env` committed; no secret in a `NEXT_PUBLIC_` variable; the service key is only in `server-only` modules. |
| Error messages | Fixed `AppError` text to the client; database errors go to the scrubbed log only. |

## Findings

### MEDIUM

**M1. A `viewer` can publish a brand's design as a template submission.** `lib/designers/actions.ts:33-39`
(`newSubmissionAction` is `auth: "member"`, no `requireAbility`); `template_submission_create` checks only that a designer
profile exists. Approved templates are readable by every signed-in user. Needs a designer profile and an admin approval to go
public, so the exposure is gated. Fix: `requireAbility(session, "manageKit")` and strip file ids from the snapshot. Status: open.

**M2. Credit-spending actions have no role check.** `lib/pattern-service/actions.ts:19-28`, the pattern-service POST,
`media` POST, `clip` and `unlock` routes: any member including `viewer` can spend the brand's credits. Decision 0042 allows
viewers to edit designs, but `ROLE_EXPLANATIONS` says viewers "cannot change anything". Fix: `requireAbility(session, "manageKit")`
on the spend paths, once the owner decides what a viewer may do. Status: open (owner decision).

**M3. Clean pictures, turntable videos and clips are outside the storage quota.** They are written to `_private/<brand>/...`
with no `files` row; `brand_storage_used` sums `files.bytes` only (`20260930040000_storage_quota.sql:54-61`). Up to 8 MB video
plus poster per turntable and 30 MB per clip, bounded only by the `startImages` rate limit. `ensureStorageRoom(admin, brandId, 1)`
in `media/route.ts` checks 1 byte. Fix: record `files` rows or sum the prefix. Status: open.

**M4. Deletion leaves `_private/<brand>/` media behind.** `lib/deletion/storage.ts:80` empties `<brandId>/` only. Generated imagery
and user-recorded video survive brand or account deletion. Fix: also empty `_private/<brandId>` in the `images` bucket, with an
integration test. Status: open. (Closest to HIGH; privacy promise, not an access-control bypass, so MEDIUM.)

**M5. A `viewer` or `kit_manager` can change brand details from the browser.** `set_brand_details`
(`20261011010000_leads.sql:162`, granted to `authenticated`) checks `belongs_to` only; `rename_brand` requires owner. The role
widening arrived in `20261025040000_club_workspace.sql:19-21`. Writes country, region, organisation type only. Fix: use
`private.can_manage_members`. Status: open.

**M6. `save_club_kit` does not check that file ids belong to the brand** (`20261025040000_club_workspace.sql:194-195`). Not
exploitable today: every reader (`createFileReader`, `lib/storage/read.ts`) filters `files.brand_id = session brand`, so a foreign
id renders as a missing picture. Defence in depth: check in the function. Status: open.

**M7. Ops pattern-file upload buffers up to ~50 MB before the admin check.** `app/(ops)/ops/pattern-requests/[requestId]/files/route.ts:21-24`.
Any signed-in user can make the server read the body (30 requests per 10 minutes) before getting "not found". Fix: admin
check before body parsing. Status: open.

**M8. Media tables expose server-only columns to members.** `media_sets` / `media_items` select grant covers `cost_microdollars`,
`provider`, `clean_path`. The files behind `clean_path` stay unreadable (storage RLS), so the exposure is cost data and a path.
Fix: column-level grants. Status: open.

### LOW

- L1. `validation` POST writes design status on `LIMITS.read` (120/min); `variants` GET renders 8 to 12 tiles on `LIMITS.read`.
- L2. `lib/server/log.ts` `KNOWN_FIELDS` includes Postgres `details`, which can echo row values (`Failing row contains (...)`,
  `Key (email)=(...)`); scrubbed for keys, not for personal data. Apply the email replacement and drop `details`.
- L3. Provider secrets (`PHOTOROOM_API_KEY`, `FASHN_API_KEY`, `GOOGLE_VERTEX_ACCESS_TOKEN`, `LIFESTYLE_*`, `MEDIA_VIDEO_LIVE`) are read
  from raw `process.env` (`lib/media/lifestyle/select.ts`, `media/route.ts:38`, `clip/route.ts:52`), outside `lib/config/env.ts`; not validated at start-up and not in `.env.example`.
- L4. Media item and video responses lack `x-content-type-options: nosniff` (`.../items/[itemId]/route.ts:26-31`, `.../video/route.ts:24-29`).
  No XSS path today (PNG re-encoded, video sniffed).
- L5. `CREDITS_ENFORCED` defaults to false: unlock is free until it is set. Production must set it; `media_set_unlock` does not itself verify a spend.
- L6. Fal video download reads the whole body when `content-length` is absent (`lib/media/video/fal.ts:41-44`). Host allow-list is sound.
- L7. `placeOrder` accepts any `fabricKey` up to 120 characters (`lib/brand-runs/place-order.ts:36`).
- L8. `club_members` returns member emails to every member including viewers; `templates` exposes `designer_id`; `royalty_accruals`
  exposes `order_id`, `project_id`, `release_id` of other brands to the designer, contradicting the migration header.
- L9. `private.can_manage_members(uuid, uuid)` is executable by `authenticated` and takes an arbitrary user id; harmless while the `private` schema is not exposed.
- L10. Append-only triggers versus `ON DELETE SET NULL` actor columns: deleting an auth user referenced by ops, settings or payout history fails.
- L11. `club_invitations` have no expiry; `ops_orders`, `batches`, `designer_template_uses` have no foreign key to brands and survive brand deletion; a member of a shared brand cannot delete their account.
- L12. `designer_record_use` does not check the project belongs to the brand or forbid a designer using their own template; `designer_accrue_after_order` swallows errors as warnings.
- L13. `pattern_request_create` takes price and charge flag from its caller; `ops_delay_order` accepts a null date; `private.ops_refuse_change` has no `set search_path` (it references nothing).
- L14. `lib/projects/assistant.ts:24` derives its signing key from `SUPABASE_SECRET_KEY`; a dedicated secret would decouple rotation.
- L15. `tests/architecture/ops-access.test.ts:38` scans only `app/api/ops` and `lib/ops`; platform-only entry points in `lib/pattern-service`, `lib/designers`, `lib/settings` and the ops pattern-file route are not covered (all currently guarded).
- L16. The watermark is a visible overlay and can be removed by a determined user; inherent to the design.

## Not reviewed

Artwork-intake PDF and SVG parsers beyond confirming SVG is never stored; they use the service client with explicit `brand_id`
filters in `lib/artwork-intake/service.ts` and have no RLS backup. Designer submission files and design-comment attachments do not exist in this tree.
