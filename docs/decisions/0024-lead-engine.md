# 0024: The lead engine: buyer kind, organisation details, quote requests and the leads page

Status: Accepted. The mail notice waits for the owner (A4); platform admins are added by hand.
Date: 2026-10-11
Plan step: wave 3 (Platform and Store Guide, 2026-10-10, pages 2, 8, 9 and 12)

## Context

The guide makes every saved design a lead: the platform captures who the buyer is, what they
want, how many and by when, scores the lead, and routes hot Australian clubs to a sales partner.
None of this existed. There are no prices, no store and no partner accounts yet.

## Decision

1. **Buyer kind first.** The guided start asks "which fits you best": team kit, launch a brand,
   creator merch, upload my design. The answer is stored on the design (`projects.buyer_kind`)
   through `set_project_buyer_kind` (server key, membership check), and the brand takes the first
   one as its segment. The three ways to start stay as they were, below the question.
2. **Organisation details on the brand.** `brands` gains organisation type (club, school, brand,
   gym or academy, event or corporate), country (ISO code) and region (one of the eight states and
   territories for Australia, free text elsewhere). All optional. Asked at brand creation, edited
   on `/brands`, and asked again in a small form beside a saved design while any is missing; that
   form never blocks the design. Members write them through `set_brand_details`.
3. **Quote requests.** A "Request a quote" form on the design and the tech pack: quantity (1 to
   1,000,000), needed-by date (after today, UTC), sizes note and message (optional). Stored in
   `quote_requests` for one version of a design, status new, quoted or closed, through
   `request_quote` (server key, membership check, brand taken from the design). Rate limited (10
   an hour). Members read their own brand's requests. The team is told through one info line in
   the server log until a mail sender exists (A4).
4. **Platform admins.** `platform_admins` holds user ids, added by hand only. No browser can read
   or write it; `private.is_platform_admin()` answers about the caller for policies, and
   `am_platform_admin()` for pages. Admins read every quote request (a second select policy) and
   every lead through `admin_lead_rows()`; they write through `admin_set_lead` and
   `admin_set_quote_status`. Each refuses anyone else with the "not found" answer.
5. **The leads page** is `/admin/leads`, in its own route group whose pages must start with
   `requirePlatformAdmin()` (architecture test). Everyone else, signed in or not, gets a 404. One
   card per brand: organisation, place, buyer kind, members' emails, designs, last activity, quote
   requests with their status, the score with its reasons, the owner (unassigned, Knitwright,
   partner) and the next step with a date. Sorted by score, then latest activity. 60 or more is
   marked "contact within 24 hours".
6. **The score** is a pure function, `leadScore` in `lib/leads/score.ts`, with every point in one
   constant, `LEAD_POINTS`. **Routing** is `suggestedOwner` in `lib/leads/routing.ts`: an existing
   owner is kept; below 60 nobody is suggested; an Australian club goes to the partner; everyone
   else to Knitwright. It only suggests.
7. Nothing is sent to HubSpot, and no marketing email is sent.

## Evidence

Unit tests in `lib/leads` (score, routing, schemas, list building, service calls). Database
tests in `tests/integration/leads.test.ts` (membership checks, the Australian state rule, admin
reads across brands, members never seeing leads or admins) and the isolation suite, which gains
`quote_requests` and a section for tables no member may read (`leads`, `platform_admins`).
Browser test `e2e/leads.spec.ts` written, not yet run.

## Alternatives

- **Admin checks in the app with the server key.** Rejected: the database enforces membership
  everywhere else, so it enforces admin rights too.
- **Making `OWNER_EMAIL` an admin at sign-up.** Not done: a row that opens every brand should be
  added on purpose. Asked in `lib/leads/OWNER-QUESTIONS.md`.
- **Requiring the organisation details to save a design.** Rejected: the guide asks for them at
  save, but blocking a free design costs more leads than it gains.

## Consequences

Partner accounts, priced quotes, sharing and paid credits will each feed the score through the
hooks in `ScoreInput`. Changing a point is one line. The admin list reads at most 1000 brands at
once; past that it needs paging.
