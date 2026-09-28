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
   before the input is validated, so invalid requests are counted too. A request with no
   session to a route that needs one is refused before it is counted.
2. **The rule is enforced by a test, not by a lint rule.** `tests/architecture/` reads
   every source file under the app with the TypeScript compiler and fails when a handler
   or action is not wrapper output, when `"use server"` appears inside a function, when
   `auth` is not written as a literal, or when a public entry point is missing from
   `lib/server/public-routes.ts`. It also fails if a `pages/` folder appears.
3. **The sign-up switch lives in the database.** Supabase Auth calls
   `public.hook_before_user_created` before it creates a user through the public API.
   The hook refuses unless `private.signup_policy.open` is true or the address is in
   `private.signup_allowlist`. The earlier `SIGNUP_OPEN` environment variable was removed,
   so there is one switch, not two.
4. **Registration takes an address only. The password is chosen after the address is
   confirmed.** A database trigger removes any password an account carries at the moment
   its address becomes confirmed, so the rule also holds for anyone who calls Supabase
   directly. See "The takeover that was found" below.
5. **The forms that send email answer the same for every address.** Sign-up and password
   reset say "check your email" whether the address is new, already registered, not
   allowed, or was asked about a moment ago. An address that already has an account is
   sent a link that signs it in.
6. **The owner's address** comes from the `OWNER_EMAIL` variable. The server puts it on
   the allowed list when that address signs up, and before any sign-in with Google.
7. **The rate limit** is one function, `public.rate_limit_hit`, which inserts or
   increments in a single statement. Only the server's secret key may call it. If the
   count cannot be kept, the request fails. It is never let through uncounted.
8. **The caller's address is read from one header only**, named by
   `CLIENT_ADDRESS_HEADER`. The default is the header Vercel writes. When it is missing,
   every caller shares one key, so a wrong setting shows as a tight limit, not as none.
9. **The bot check is verified by Supabase Auth**, not by our code, so it also applies
   to anyone who calls Supabase directly. A token works once, so it cannot be verified
   in both places.
10. **A link in an email opens a page with a button.** The token is used when the button
    is pressed, so a mail scanner that opens links cannot use it up first.
11. **Sessions are read with `getClaims()`**, which verifies the token's signature. A
    failure to reach the sign-in service is reported as an error, not as "signed out".
    Session cookies are hidden from scripts and are sent over https only on an https site.
12. **Pages that read settings are rendered on request**, never when the app is built,
    so a build holds no settings and needs no secrets.

## The takeover that was found

Review on 2026-09-29 raised the question. An experiment on local Supabase confirmed it:

1. Someone registers the owner's address with a password of their own choosing.
2. Supabase sends the owner a normal confirmation email.
3. The owner, who was expecting to register, presses the button.
4. The account is now confirmed and the other person's password signs in.

Supabase Auth allows this by design. It affects any address, and an address on the
allowed list most of all, because it is known to be welcome. Decision 4 closes it. The
test `tests/integration/password-rule.test.ts` reproduces the four steps and asserts
that the last one fails.

## Evidence

| Claim | Test |
|---|---|
| A route without the wrapper fails | `tests/architecture/wrapper-check.test.ts`, 36 cases |
| The app's own routes and actions all pass | `tests/architecture/repo.test.ts` |
| A redirect inside a handler still reaches the framework | `lib/server/core/next-control-flow.test.ts`, with the framework's real functions |
| No session, no access, for every route off the allow list | `e2e/unauthenticated.spec.ts`, which finds routes on disk |
| With the switch closed a new address cannot register | `tests/integration/signup-policy.test.ts`, `e2e/accounts.spec.ts` |
| A password chosen before confirmation does not survive it | `tests/integration/password-rule.test.ts` |
| The email forms answer the same for every address | `tests/integration/auth-service.test.ts` |
| The limit holds when 50 requests arrive at once | `tests/integration/rate-limit.test.ts`: exactly 10 of 50 pass a limit of 10 |
| A body of unknown length is not read past the limit | `lib/server/core/create-define-route.test.ts`. Before the fix this test ran the process out of memory. |
| Session cookies are hidden from scripts | `e2e/hardening.spec.ts` |
| Pages cannot be framed by another site | `e2e/hardening.spec.ts` |

Found while testing, and worth knowing:

- Supabase's admin API does not run the before-user-created hook. It needs the secret
  key, which only the server holds.
- Supabase answers `user_already_exists` and `over_email_send_rate_limit` only for
  addresses that have an account. The app hides both.
- Supabase creates an account first and confirms it in a second step, even when the
  server asks for both at once. So the server sets a password in a further step.
- Supabase refuses an `update` with no `where` clause.

## Alternatives

- **A lint rule banning inline `"use server"`**, as the plan says. The lint
  configuration is protected by a hook in the owner's tooling and was not changed. The
  architecture test gives the same guarantee and runs in the same gate.
- **The switch as an environment variable only.** It would guard our own forms but not
  Supabase's public API, which anyone can call with the publishable key.
- **Turning off sign-up in Supabase and creating users from the server.** It would also
  block new users arriving through Google.
- **Refusing a password on an unconfirmed account outright.** Tried first. Supabase
  itself gives new accounts a random password, so every sign-up failed.
- **Rate limiting in memory or in a hosted key-value store.** Memory does not survive
  across serverless instances. A hosted store adds a vendor and a cost.

## Consequences

- The owner opens sign-up with one statement: `select public.set_signup_open(true);`.
- A stranger who asks for a link while sign-up is closed is told to check their email
  and receives nothing. The page says above the form that sign-up is by invitation.
- All sign-in traffic reaches Supabase from the server's address, so Supabase's own
  per-address limits see one address. Our limits are per caller and come first. Raise
  Supabase's limits in its dashboard before launch. See `docs/runbooks/supabase-hosted.md`.
- The hosted project's settings are made by hand. `scripts/check-auth-settings.mjs`
  checks the ones that can be checked from outside. CI runs it against local Supabase.
- Four files that only join Next.js to tested code are left out of unit coverage and
  are covered by the end-to-end tests: `lib/server/deps.ts`, `define-route.ts`,
  `define-action.ts` and `lib/**/actions.ts`.

## Left for later, on purpose

| Item | Where it goes |
|---|---|
| A script policy with a nonce for each request | Step 26, launch hardening |
| A sign-in limit for each account as well as each address. It stops guessing spread over many addresses, but lets a stranger lock someone out. | Step 26, with alerting |
| Every page under the studio checking the session itself, not only the layout | Step 3, with `verifySession()` |
| Tests for the React form components themselves. Their logic is tested in `lib/forms`, their behaviour in the browser tests. | When a component test setup is added |
