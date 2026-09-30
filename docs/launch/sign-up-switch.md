# The sign-up switch

Plan step 26, task 7. **The switch is closed and stays closed** until the owner opens it (owner
action A9 and the checklist below). This branch does not open it.

## How it works

- `private.signup_policy` holds one row with `open` (false by default). Migration
  `supabase/migrations/20260929000200_signup_policy.sql`.
- Supabase Auth calls `public.hook_before_user_created` before it creates any user who arrives
  through the public API (email and password, or Google). While `open` is false the hook refuses
  everyone except addresses on `private.signup_allowlist`. Calling Supabase directly from a
  browser cannot get round it.
- The sign-up page reads `public.signup_is_open()` and says when sign-up is closed.
- `OWNER_EMAIL` in the app's environment is added to the allow list when the owner starts Google
  sign-in, so the owner can always get in.

The hook only works if it is switched on in the hosted project: Supabase dashboard,
Authentication, Hooks, "Before user created", Postgres function `public.hook_before_user_created`
(see `docs/runbooks/supabase-hosted.md`). **Without it anyone can register, whatever the switch
says.** Check it first.

## Before opening

Every line must be true, and the owner signs the last one.

- [ ] The terms, privacy notice and data-processing terms (`docs/legal/`) are approved by the owner
      and a lawyer, placeholders in [square brackets] are filled, and each document's `status` in
      `apps/web/lib/legal/` is set to `"approved"` (then run
      `pnpm --filter web exec tsx scripts/write-legal-docs.mts`). Owner action A9.
- [ ] No Critical or High finding is open in `docs/launch/security-review.md`, including the review
      of AI prompts at integration, and S-01 (storage quota) is fixed.
- [ ] `docs/launch/evidence.md` is complete and the owner has read it.
- [ ] The load run in `docs/launch/evidence.md` is done against the deployment.
- [ ] Vercel is on Pro, with Node 22 or 24 (A2). Email sending is set up (A4). AI keys have spend
      limits in each provider's console (A3). Turnstile uses real keys, not the test keys.
- [ ] `MONITORING_DSN` is set, and one test error was seen to arrive (see ADR 0023).
- [ ] The spend alert has a destination the owner watches.
- [ ] Owner approval to open: [owner: name and date].

## Opening

In the Supabase dashboard, SQL editor, on the production project:

```sql
select public.set_signup_open(true);
select public.signup_is_open();  -- must answer true
```

`set_signup_open` can be run only by the server's key or the database owner; a browser cannot.
From a script with the secret key instead:
`await admin.rpc("set_signup_open", { p_open: true })`.

Then open `/sign-up` in a private window: the "not open to new accounts yet" notice must be gone,
and a new address must be able to register.

## Letting one person in while closed

```sql
select public.allow_signup_email('person@example.com', 'Beta tester, invited by the owner');
```

## Closing again (the rollback for step 26)

```sql
select public.set_signup_open(false);
```

Closing stops new accounts only. Existing users keep their accounts and can still sign in.
