# 0026: Share links with comments and votes

Status: Accepted. Questions for the owner in `apps/web/lib/share/OWNER-QUESTIONS.md`.
Date: 2026-10-11
Plan step: wave 3 (Platform and Store Guide, module 4)

## Context

The Platform and Store Guide (2026-10-10) has clubs and brand teams share a design with their
committee or co-founder, who comment and vote without an account (p.3, module 4). The member
sends the link themselves: Knitwright never emails the people invited (p.10). An Australian
partner sends the same link after a club meeting (p.12). The page is public and unauthenticated,
so it is the first page that shows a brand's design to someone who is not a member.

## Decision

1. **A link points at one saved version.** It is made from the design page ("Share with your
   committee") at the newest version; when the design moves on, the member may move the link to
   the newest version. A link lasts 7, 30 or 90 days, and a member can revoke it.
2. **The token is 256 random bits, and only its SHA-256 hash is stored** (`share_links`). The
   address is shown to the member once. The database hashes the token itself, in the share
   functions, so a token never reaches a table, and the rate limit names a link by the hash too.
3. **Every write, and every read with a token, goes through security definer functions that only
   the server's own key may run** (`supabase/migrations/20261011030000_share_links.sql`):
   `create_share_link`, `revoke_share_link`, `move_share_link`, `open_share`, `share_respond`.
   Members read their brand's links and answers through row level security. Neither table can be
   written by any browser role, and both are in the isolation suite.
4. **An unknown, expired or revoked token takes one path** (one lookup by the unique hash with the
   revoked and expiry conditions in the same query) and gives the ordinary page that does not
   exist. A token of the wrong shape is refused before the database, which tells an attacker
   nothing they did not know.
5. **The public page shows only the design name, the brand name, the front and back drawn by the
   tech pack's renderer without callouts, and the colours and fabrics** (`lib/share/public-view.ts`).
   Pictures are read on the server, for the link's brand and only those the shared version's
   artwork names, and drawn into the page as data addresses; no storage address is ever sent.
   The page sends `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive`,
   `Cache-Control: private, no-store` (next.config.ts) and noindex metadata.
6. **A visitor gives a name and a vote ("Yes, I like it" or "Not yet"), a comment, or both.** No
   email address is asked. A random key in an httpOnly cookie (path `/s`) identifies the browser;
   the stored value is SHA-256 of the link and the key, so it cannot follow a browser between
   links. A browser's second answer replaces its first. Turnstile is checked by the app
   (`TURNSTILE_SECRET_KEY`; Cloudflare's always-pass test secret stands in locally), and answers
   are limited per address and per link, with a cap of 300 browsers per link. Comments are shown
   as plain text only.
7. **Deletion follows the keys.** Links cascade from the design (and so from the brand), answers
   from the link; `created_by` is set to null when an account goes.

## Evidence

- `tests/integration/share-links.test.ts` (17 tests): hash only, version, expiry, wrong, revoked
  and expired tokens return nothing, one brand cannot see or change another's links or answers,
  vote upsert per visitor, length and value limits, no browser role may call any share function,
  deletion of a design and of an account removes links and answers.
- `tests/integration/share-service.test.ts` and the isolation suite (two new tables).
- Unit tests in `lib/share/*.test.ts`, `lib/config/env.test.ts`, `tests/architecture/next-config.test.ts`.
- `e2e/share.spec.ts` (create, open in a fresh context, vote and comment, tally, revoke then 404):
  written, not run in this branch.

## Alternatives

- **Functions open to the browser's (publishable) key.** The brief suggested anonymous access
  through security definer functions. The publishable key is public, so anyone holding a link
  could then call `share_respond` past Turnstile and the rate limits, and `open_share` would hand
  them the whole stored design (measurements, construction, labels) rather than what the page
  shows. Only the server calls them, after its own checks.
- **Storing the token, or deriving it from a server secret, so a link can be copied again.**
  Refused: a database or secret leak would open every link. Members make a new link instead.
- **Signed short-lived storage links for pictures.** They would put storage addresses in the page
  that work without the token while they last. Drawing pictures into the page avoids that.

## Review

Security review before commit (2026-10-11): no critical or high findings. Fixed: the per-link
limit is counted only after the bot check passes (a holder of the link could otherwise use it up
with failed attempts); the log scrubber removes a share token from any address it sees. Left open:
a holder of the link who clears their cookie can answer as many "visitors" as the 300 cap allows
(owner question 5); the host's own access logs hold live tokens in request paths (set the host and
monitoring to mask `/s/*`); Turnstile's hostname and action are not compared; with no secret set,
any build that is not a production deploy falls back to the always-pass test secret.

## Consequences

The server's key is used on a public page, but only through the share functions and a file reader
fixed to the link's brand and to the files the shared version names. A reviewer who wants
anonymous grants can add them in one line per function, but must then filter the design in SQL and
accept that Turnstile can be skipped. Revisit when visitors may opt in to email (owner question 1),
or when price or 3D is added to the page.
