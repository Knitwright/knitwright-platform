# 0025: Consent to marketing email, unsubscribe links and logo rights

Status: Accepted. Legal text is a draft for lawyer review (A9); Australian questions open for the owner.
Date: 2026-10-11
Plan step: wave 3 (beta alignment with the Platform and Store Guide)

## Context

The owner's Platform and Store Guide (2026-10-10) makes Australian clubs the first market. Page 10
sets consent and privacy rules for Australia: the Spam Act needs consent before marketing email,
a message that identifies Knitwright and a working unsubscribe honoured within 5 working days;
an unticked opt-in box at sign-up with a record of when each person agreed; never email the people
a user invites; a privacy policy; ask an Australian adviser whether the Privacy Act applies.
Page 14 lists two risks: users uploading logos they do not own (rights checkbox at upload; refuse
pro team and brand logos without a licence) and marketing without consent (opt-in, unsubscribe in
every message, consent records). No email provider exists yet (A4), so nothing is sent.

## Decision

1. **Consent is a list of events that is only added to.** `public.consent_events` (migration
   `20261011020000_consent.sql`): person, purpose (`marketing_email`), yes or no, the exact words
   shown and their version, where (`sign-up`, `settings`, `unsubscribe`), when. The choice is the
   latest event; no event means no. A person reads only their own rows. Nobody writes but the
   server, through `record_consent` (service role only), and a trigger, below. Rows cannot be
   changed or removed, even by the table owner, except by the cascade when the account is deleted.
2. **The words come from the database, never the caller.** `private.consent_wordings` holds each
   version's text and cannot be edited; `lib/consent/wording.ts` holds the same rows, and a db test
   checks they match. A new wording is a new version in both places.
3. **Sign-up, email path:** the form's unticked box travels as profile data
   (`{ marketing_email: { granted, version } }`) with `signInWithOtp`, because the account does not
   exist until the sign-in service makes it. An `after insert` trigger on `auth.users` records it.
   A malformed or unknown value is ignored (no record, so no), never refused. An existing address
   that signs up again changes nothing.
4. **Sign-up, Google path:** the same box's state is sent with the Google button and held in a
   ten-minute, http-only cookie; `/auth/callback` records it after the session exists, only for a
   person never asked before. A failure to record is logged and does not block sign-in (the safe
   default is no). The sign-in page asks nothing and records nothing.
5. **Settings** shows the current choice and writes a new event only when it changes.
6. **Unsubscribe** at `/unsubscribe?token=...`: the token is an HMAC of the person's id, signed
   with a key derived from `UNSUBSCRIBE_SECRET`, which a deploy must set (review of wave 3: then
   changing the server secret breaks no sent link); locally from the server secret. It
   never runs out. The page (GET) changes nothing; its button (a public server action, rate limited,
   no bot check) records a withdrawal at once with the unsubscribe wording. A tampered link is
   refused in plain words; a link for a deleted account succeeds with nothing to record.
7. **`canSendMarketing(events)`** in `lib/consent/consent.ts` is the one check a future sender must
   use. A no at the same moment as a yes wins.
8. **Never email people a user invites.** A rule, not code: any feature that collects addresses of
   other people (the committee share link, layer E teams) may email them only a message they asked
   for, and never marketing, unless they sign up and opt in themselves. The privacy notice says so.
9. **Logo rights:** uploading artwork (the editor's "Logo or picture") needs the box "I own this
   logo or have permission to use it on garments." The upload route refuses artwork without it, in
   plain words, before storing anything. The confirmation is kept on the file's row
   (`rights_confirmed_by`, `rights_confirmed_at`, `rights_wording_version`); the database requires
   time and wording together, only on artwork, only with logo-rights words. A sketch or photo read
   by the guided flow is never printed and asks nothing. Files stored before this change have none.
10. **Legal drafts** gain Australian sections (Spam Act, Privacy Act 1988 and the APPs with overseas
    hosting, access and correction and the OAIC, the Australian Consumer Law for goods made to the
    buyer's design, AUD prices) and a "Logos and artwork" section in the terms (pro team and brand
    logos need a licence; Knitwright may refuse them). The UK, EU and worldwide text, and the
    governing law clause (England and Wales), are unchanged. Questions 15 to 20 in
    `apps/web/lib/legal/OWNER-QUESTIONS.md`.

## Evidence

Unit tests: `lib/consent/*.test.ts`, `lib/storage/rights.test.ts`, `lib/projects/artwork-upload.test.ts`,
`lib/legal/documents.test.ts`. Database tests: `tests/integration/consent.test.ts`,
`tests/integration/logo-rights.test.ts`, and `consent_events` in the isolation suite (a new
`ownedBy: "user"` mode, since the rows are a person's, not a brand's). Browser tests written, not run:
`e2e/consent.spec.ts`, and the rights box in `e2e/brands.spec.ts` and `e2e/flats.spec.ts`.

## Alternatives

- A consent column on a profile table: loses the history the Spam Act record needs.
- Letting a browser insert its own rows under row level security: the wording and source could be
  forged; a server function keeps them honest.
- An expiring unsubscribe token: the law wants the link to work for at least 30 days; a link that
  still works later can only stop email, so it never expires.
- Recording the Google sign-up choice in the auth hook: the hook runs before the account exists and
  sees no form data.
- Requiring rights in `storeImage` itself: the route is the only way artwork arrives from a person;
  the database constraints keep any record consistent.

## Consequences

- A future email sender must read `consent_events` and call `canSendMarketing`, put
  `unsubscribeUrl(...)` in every message, and name Knitwright and its contact details (A4, owner
  question 19). A one-click unsubscribe header (RFC 8058) will need a POST route when that sender
  exists.
- The profile data from the email path keeps `marketing_email` in `user_metadata`; it is not the
  record and must not be read as one.
- Revisit when the owner answers the governing law and Privacy Act questions, or when team names and
  numbers need the same rights box (owner question 20).
