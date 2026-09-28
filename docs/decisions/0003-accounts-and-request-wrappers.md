# 0003: Accounts, the sign-up switch and request wrappers

Status: Accepted
Date: 2026-09-29
Plan step: 2

## Context

The product is open to the public and will call paid AI services. The proof of concept's
paid routes accepted anonymous requests. Step 2 asks for sign-up with email
verification and a bot check, sign-in with Google, a sign-up switch that is closed by
default, a rate limit held in Postgres, and wrappers that every route and action must use.

## Decision

1. **Every route handler is made with `defineRoute` and every server action with
   `defineAction`.** Each checks the session, counts the request against the rate limit,
   validates the input with Zod, and only then runs the handler. The limit is counted
   before the input is validated, so invalid requests are counted too.
2. **The rule is enforced by a test, not by a lint rule.** `tests/architecture/` reads
   every source file with the TypeScript compiler and fails when a handler or action is
   not wrapper output, when `"use server"` appears inside a function, when `auth` is not
   written as a literal, or when a public entry point is missing from
   `lib/server/public-routes.ts`.
3. **The sign-up switch lives in the database.** Supabase Auth calls
   `public.hook_before_user_created` before it creates a user through the public API.
   The hook refuses unless `private.signup_policy.open` is true or the address is in
   `private.signup_allowlist`. The earlier `SIGNUP_OPEN` environment variable was removed,
   so there is one switch, not two.
4. **The owner's address** comes from the `OWNER_EMAIL` variable. The server puts it on
   the allowed list when that address signs up, and before any sign-in with Google.
5. **The rate limit** is one function, `public.rate_limit_hit`, which inserts or
   increments in a single statement. Only the server's secret key may call it. If the
   count cannot be kept, the request fails. It is never let through uncounted.
6. **The bot check is verified by Supabase Auth**, not by our code, so it also applies
   to anyone who calls Supabase directly. It is on for sign-up, sign-in and password
   reset.
7. **A link in an email opens a page with a button.** The token is used when the button
   is pressed, so a mail scanner that opens links cannot use it up first.
8. **Sessions are read with `getClaims()`**, which verifies the token's signature. A
   failure to reach the sign-in service is reported as an error, not as "signed out".

## Evidence

| Claim | Test |
|---|---|
| A route without the wrapper fails | `tests/architecture/wrapper-check.test.ts`, 29 cases |
| The app's own routes and actions all pass | `tests/architecture/repo.test.ts` |
| No session, no access, for every route off the allow list | `e2e/unauthenticated.spec.ts`, which finds routes on disk |
| With the switch closed a new address cannot register | `tests/integration/signup-policy.test.ts`, `e2e/accounts.spec.ts` |
| The limit holds when 50 requests arrive at once | `tests/integration/rate-limit.test.ts`: exactly 10 of 50 pass a limit of 10 |
| Sign-up, confirmation, sign-in, sign-out, reset | `tests/integration/auth-service.test.ts`, `e2e/accounts.spec.ts` |

Found while testing, and worth knowing:

- Supabase's admin API does not run the before-user-created hook. It needs the secret
  key, which only the server holds, so the switch still cannot be skipped from a browser.
- Supabase answers `user_already_exists` when a confirmed address signs up again. The
  app gives the same answer as for a new address, so the form cannot be used to find out
  who has an account.
- Supabase refuses an `update` with no `where` clause.

## Alternatives

- **A lint rule banning inline `"use server"`**, as the plan says. The lint
  configuration is protected by a hook in the owner's tooling and was not changed. The
  architecture test gives the same guarantee and runs in the same gate.
- **The switch as an environment variable only.** It would guard our own forms but not
  Supabase's public API, which anyone can call with the publishable key.
- **Turning off sign-up in Supabase and creating users from the server.** It would also
  block new users arriving through Google.
- **Rate limiting in memory or in a hosted key-value store.** Memory does not survive
  across serverless instances. A hosted store adds a vendor and a cost.

## Consequences

- The owner opens sign-up with one statement: `select public.set_signup_open(true);`.
- All sign-in traffic reaches Supabase from the server's address, so Supabase's own
  per-address limits see one address. Our limits are per caller and come first. Raise
  Supabase's limits in its dashboard before launch. See `docs/runbooks/supabase-hosted.md`.
- The caller's address is read from headers the host writes. The order in
  `lib/server/core/client-address.ts` is right for Vercel. Check it again on another host.
- Four files that only join Next.js to tested code are left out of unit coverage and
  are covered by the end-to-end tests: `lib/server/deps.ts`, `define-route.ts`,
  `define-action.ts` and `lib/**/actions.ts`.
