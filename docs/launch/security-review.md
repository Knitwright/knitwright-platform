# Security review before public beta

Plan step 26, task 1. Reviewed 2026-09-30 on branch `release/public-beta`, cut from
`feat/exports` (5be3505), by reading the code and the SQL. Nothing was run against a database
(Docker was down). Scope: accounts, uploads, routes, storage, brand isolation, exports, secrets,
and the deletion code added in this step.

**Result: no Critical or High finding is open.** One Medium and seven Low findings remain, listed
below with the owner or step that closes each. The acceptance criterion of step 26 ("no critical
or high security finding is open") holds for this branch.

**Not covered here: AI prompts.** Text input, sketch and photo reading and photoreal images are
on other branches (`feat/intent-*`, `feat/images`, merged on `integration`). They must be reviewed
at integration, before sign-up opens: see "Owed" at the end.

## Findings

| ID | Severity | Where | Finding | Status |
|---|---|---|---|---|
| S-01 | Medium | `app/api/files/route.ts`, `lib/storage/store.ts` | No storage quota per brand or user. Uploads are rate limited (30 per 10 minutes, 8 MB each), and files are never cleaned up, so one account could add about 34 GB a day once sign-up opens. The Supabase free tier holds 1 GB. | Open. Fix before opening sign-up: count and sum `files` per brand in `storeImage` and refuse past a cap (the owner sets it, for example 200 files or 500 MB). Deleting designs and accounts (this step) now removes files. |
| S-02 | Low | `next.config.ts` | The content security policy has no `script-src` or `default-src`, so it gives no defence in depth against script injection. No `dangerouslySetInnerHTML`, `innerHTML` or `eval` was found. | Open. Add a nonce-based policy in `proxy.ts` after integration, when every page's scripts are known. |
| S-03 | Low | `lib/config/env.ts`, `lib/server/core/client-address.ts` | The rate limit trusts one address header (`x-vercel-forwarded-for` by default). Off Vercel, a client could set it; when it is missing, every caller shares one `unknown` bucket. | Open. Documented as host-specific. Check on the first deployment that the header arrives. |
| S-04 | Low | `lib/server/core/guard.ts` | Sign-in, sign-up and reset are limited per address, not per email, so many addresses can try one account. Supabase's own limits and Turnstile also apply. | Open. Add an email-keyed bucket (a hash of the address) to `signIn`, `signUp` and `passwordReset`. |
| S-05 | Low | `lib/server/session.ts`, `lib/auth/service.ts` | Sessions are checked by token signature, so a signed-out or stolen token stays usable until it expires (1 hour). A password change does not sign out other devices. | Open. Call `signOut({ scope: "others" })` after `updatePassword`; consider a shorter token lifetime. After account deletion (this step) a token still passes the signature check for up to an hour, but every brand and design is gone and a new brand cannot be created for a user that no longer exists. |
| S-06 | Low | `lib/server/log.ts` | Log scrubbing removed only Supabase keys, JWTs and database URLs. | **Fixed in this step.** Bearer values, `token_hash`, `access_token`, `refresh_token` and `code` values are now removed (test in `lib/server/log.test.ts`). Error monitoring also removes email addresses before anything leaves the server (`lib/monitoring/monitor.test.ts`). |
| S-07 | Low | `lib/config/env.ts` | Nothing stops Cloudflare's always-passing Turnstile test key from being used in production. A test *secret* in the hosted Supabase project would accept any token. | Open on this branch. The step 9 fix pass (main repo, `feat/exports`, uncommitted when this was written) makes `env.ts` refuse test site keys in production. The owner must confirm the hosted Turnstile secret is real (runbook `docs/runbooks/supabase-hosted.md`). |
| S-08 | Low | `lib/deletion/actions.ts` | Account deletion asks the user to type "delete" but does not ask them to sign in again. Someone with a stolen session could delete the account. | Open. Rate limited to 3 an hour. Add a fresh sign-in (or an emailed code) before deletion when email sending (A4) is in place. |

Info items: the app relies on hosted Supabase settings matching `supabase/config.toml` (sign-up
hook on, captcha on, confirmations on, anonymous sign-ins off, only `public` exposed; the `private`
tables have no row-level security and are safe only because that schema is not exposed). Check
them against the runbook before launch. The rate-limit table is cleaned in about 1% of calls,
which is fine at this scale. Unauthenticated calls to member routes are refused before they are
counted, which is cheap.

## Checked and found sound

**Accounts.** The sign-up switch (`hook_before_user_created`) is closed by default and runs only as
`supabase_auth_admin`; `set_signup_open` and `allow_signup_email` are server-only. The password
pre-hijack guard clears a password set before confirmation. Sign-up and reset answer the same for
known and unknown addresses. Emailed links are confirmed by a POST, so mail scanners cannot use
them up. The Google callback redirects only to fixed paths, uses PKCE and never echoes error text.
Session cookies are httpOnly, SameSite=Lax and Secure over https.

**Routes and actions.** Every route handler and server action is the output of `defineRoute` or
`defineAction` (architecture test `tests/architecture/repo.test.ts`), each names a rule from
`lib/server/limits.ts` (`tests/architecture/rate-limits.test.ts`, new in this step), and each
checks the session, the brand and the input. Public entry points are listed in one file. The rate
limiter fails closed. Body size is capped while it is read. The brand always comes from the
session, and the active-brand cookie is only a preference checked against memberships. Next.js
checks the Origin of server actions.

**Brand isolation (M5).** Every public table has row-level security with select policies only; no
browser may insert, update or delete. Every write function is server-only and checks membership
itself, giving the same answer for a missing and a foreign record. `spec_versions` and
`export_downloads` are append-only by grant and by trigger. The isolation suite enumerates every
table, bucket and callable function, so a new one cannot be added without a decision.

**Uploads and storage.** Buckets are private, with an allow-list of types and no SVG. Reads are
limited to members by the first folder of the path; there are no write policies. The server
builds every path from the brand id and a random id. Uploaded pictures are checked by their bytes,
capped at 8 MB and 40 megapixels, and re-encoded, which strips metadata. Signed links last 60
seconds and are made only from a file id that the user's own client can read.

**Exports.** Member-only, rate limited, strict parameters; built in memory, recorded, then sent,
and nothing is sent if the record fails. SVG text is escaped, colours are limited to `#rrggbb`,
files are attachments with `nosniff`, `no-store` and a sandboxing policy. File names are ASCII or
RFC 5987 encoded. No Excel cell can become a formula.

**Secrets.** Only `.env.example` files are committed. The secret key is read only on the server,
and environment errors name variables, never values.

**Deletion (new in this step).** The four new database functions are callable only with the
server's key and check membership and the active brand themselves. A design's deletion removes
only files of its own brand that no other design of that brand uses; a file id in the artwork that
belongs to another brand is never touched. Storage objects are removed before the rows, so a
failure leaves rows without files (which the app treats as missing) and never files without rows.
Folder listings are built only from ids that pass a UUID check, so they cannot reach another
brand's folder. An account whose brand has another member is refused, so deleting one account can
never delete another person's work. See `docs/decisions/0023-launch-hardening.md`.

## Dependencies

No production dependency has a known advisory (164 packages, npm advisory database, 2026-09-30).
No licence requires the app's source to be published. See `docs/launch/licences.md`.

## Owed

- **Prompts and AI input** (steps 11 to 15, other branches): review at integration that model
  output is parsed and never trusted (M2), that proposals are signed (HMAC) and re-validated on
  apply, that uploaded images cannot carry instructions that bypass the gates, that provider keys
  stay server-side, and that image prompts carry no personal data. Owner: whoever runs integration.
- **S-01 storage quota** before sign-up opens (cap value owed by the owner).
- **Load verification** of rate limits and usage ceilings needs a deployment. See
  `docs/launch/evidence.md`.
- **Hosted settings check** against `docs/runbooks/supabase-hosted.md` on the production project.
