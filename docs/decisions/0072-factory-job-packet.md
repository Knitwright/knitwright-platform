# 0072: Factory job packet (a link, no account)

Status: Proposed. Owner questions below. The database tests and the end-to-end test have not run in the sandbox
that wrote this (no Docker); CI runs them.
Date: 2026-10-29
Plan step: platform v5, wave 1, workstream X7. Spec F-O2 (`docs/spec/02-features.md`),
`docs/spec/05-architecture.md` "Security and privacy".

## Context

A Sialkot factory never logs in (decision 0043). Today ops downloads the factory sheet and the print files and
sends them on by hand, and types the factory's replies back into `/ops`. F-O2 asks for the other half: per batch,
the factory gets a signed, expiring, revocable link to a page holding the job sheet, the order list, the size
breakdown, the name and number list, the BOM, a ZIP of print files and patterns, and the due date; the factory
presses Received / In production / Ready for QC, writes notes and uploads photos; the link also goes out as a
WhatsApp message, "because Sialkot factories run on WhatsApp". Its acceptance test is **zero manual file
preparation by ops per order, and every status change timestamped**.

The platform already has a page open to anyone holding a link: the committee share page (decision 0026). The job
packet is the same shape with one difference that matters — the holder of the link may **write**: it moves real
orders through the ops status machine and adds files to storage. So the token model is copied from decision 0026
and tightened, and every write stays inside what the ops console itself allows.

## Decision

1. **Two tables** (`supabase/migrations/20261101060000_job_packets.sql`).
   - `job_packets`: batch id, `token_hash` (32 bytes, unique), `created_by`, `created_at`, `expires_at`,
     `revoked_at`, `sent_count`, `last_sent_at`. A partial unique index gives a batch **at most one packet that
     has not been revoked**, so there is never a second live address for one batch.
   - `factory_events`: packet, batch, kind (`received | in_production | ready_for_qc | note | photo`), note
     (≤ 1000 characters, trimmed), `photo_keys`, `orders_moved`, `at`. A check ties a photo to exactly one key and
     a note to at least one character.
   No foreign key into another workstream's tables beyond `batches`, as decision 0043 set out.

2. **The token is 256 random bits and only its SHA-256 hash is stored.** The server makes the token
   (`lib/job-packet/token.ts`), shows the address to ops once in the answer to the action, and hands the token to
   the database, which hashes it itself (`private.job_packet_hash`): a token never reaches a column, a log or the
   rate-limit table (the limits name a packet by the hash; `lib/server/log.ts` scrubs `/job/<token>` as it already
   scrubs `/s/<token>`). A token of the wrong shape is refused in TypeScript before the database is asked.

3. **Default 28 days, 90 at most, revocable, and "send again" rotates the token.** Four weeks covers a batch from
   cut-off to QC. `resend_job_packet` gives the packet a **new** token and a new expiry and counts the send, so the
   old address stops opening anything; it is the right answer to "the factory lost the message" and to a leak.

4. **One path for unknown, expired and revoked.** `private.open_job_packet` is a single lookup by the unique hash
   with the revoked and expiry conditions in the same query. The page calls `notFound()`, the routes answer 404,
   and `job_packet_record` raises the same "That link does not exist." for all three, so a holder learns nothing
   they did not already know.

5. **Every write goes through SECURITY DEFINER functions only the server's key may run.** `create_job_packet`,
   `resend_job_packet`, `revoke_job_packet` take the actor and the batch and call `private.require_ops_actor`, so
   the database checks the platform admin itself; the three ops actions check it again through
   `assertPlatformAdmin`. `open_job_packet` and `job_packet_record` take the token. The service role holds **only
   SELECT** on both tables (Lessons 3), and `factory_events` carries a trigger that refuses UPDATE, DELETE and
   TRUNCATE, so what a factory recorded can never be changed or removed — not by a browser, not by the server's
   key and not by the owner of the table. Row-level security lets platform admins read both tables; members and
   visitors read nothing. There are no insert, update or delete policies, on purpose.

6. **Resend and revoke name the batch as well as the packet.** The function refuses a packet that belongs to
   another batch, so the page ops is looking at is the only packet it can renew or revoke, and the WhatsApp text
   can never describe one batch while renewing another's link.

7. **The three buttons are the ops status machine, no more.** `job_packet_record` locks the batch, takes a step
   only in order and only once (`received` → `in_production` → `ready_for_qc`), and moves **every order of the
   batch standing at the step before** with the same transitions and the same history rows `ops_set_order_status`
   writes, with `actor` null and the note "Marked by the factory through its job packet." The factory can move no
   order it was not given, can skip no step, can go back no step, and can hold, delay or ship nothing.
   `lib/job-packet/steps.ts` holds the same table and the database test holds the two to each other. The page
   offers exactly one button: the next step, or a sentence when the batch is ready for QC.

8. **Photos: the bytes decide.** A photo goes through the one check every uploaded image passes
   (`lib/storage/image.ts`): the type is sniffed from the first bytes (PNG, JPEG or WebP; the browser's word is
   ignored), the file is held to 8 MB and 40 megapixels, and the image is **read and written out again**, so what
   is stored is pixels only — no EXIF, no camera, no place, no time, nothing appended to the file. It is stored in
   the private `uploads` bucket under `job-packets/<packet id>/<uuid>.(jpg|png)`, never under a brand folder, so
   the "members read their brand's files" policy can never match it (its first segment is not a brand id). The
   database refuses to record a key that is not that shape for that packet. A failed recording removes the file.
   Only a platform admin may read one back, through `/api/job/events/[eventId]/photo`.

9. **Limited twice: per address and per packet.** The factory has no account, so the link is the only key. The
   wrapper limits the caller's address (`job-packet-view`, `job-packet-files`, `job-packet-record`,
   `job-packet-photo`), and `withPacketLimit` limits the **packet** as well, so many addresses holding one link
   cannot flood its history. The photo route checks the token and the packet's limit in `authorize`, before the
   body is read, so an unknown link never costs 8 MB of buffering. The database adds a ceiling of 1000 events and
   200 photos per packet.

10. **The page shows that batch and nothing else.** Everything is read for the batch the token's packet names,
    never for anything the visitor sent, and the lists are built by `buildSheet` — the same model as the factory
    sheet PDF — so the page and the PDF can never disagree. It is not indexed, not cached and sends no referrer
    (`next.config.ts` reuses the share headers for `/job/:token` and `/api/job/:token/*`), and it carries no link
    into the signed-in app.

11. **One ZIP, deterministic.** `lib/job-packet/zip.ts` holds `README.txt`, `job_sheet.pdf` and the batch's print
    files exactly as the ops console builds them, with their manifest (decision 0043). It carries no clock, every
    path is sanitised into its own folder, and the same inputs give the same bytes.

12. **Patterns come through an interface.** `PatternSource` is the seam the production package assembler (X5)
    fills in wave 2 (plan Lessons 9). Until then `noPatterns` adds nothing and the README says, in plain words,
    that Knitwright sends the pattern files separately — never a guessed pattern.

13. **WhatsApp is a provider interface with a stub.** `lib/job-packet/notify.ts`: `stubNotifier` sends nothing and
    says "WhatsApp is not set up. Copy the link and send it to the factory yourself." The WhatsApp Business Cloud
    API adapter exists only when **both** `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` are set; neither is set where
    tests run, and a test asserts that, so **nothing calls WhatsApp in CI**. The message is plain text with the
    link, the due date, what each button does and the day the link stops. A refusal or a timeout never fails the
    action: ops still gets the address and the reason.

14. **Ops works from the batch page.** `PacketSection` adds one section to
    `app/(ops)/ops/batches/[batchId]/page.tsx` (the smallest change the plan allows): make, send again or revoke
    the link, and the list of what the factory recorded, with a link to each photo. The address is shown once,
    when it is made.

## Mapping to the spec

| Spec (F-O2) | Here |
| --- | --- |
| job sheet PDF | `/api/job/[token]/sheet`, the existing `factorySheetPdf` |
| order list, size breakdown, name/number list, BOM, due date | the page, from `buildSheet` |
| ZIP of print files and patterns | `/api/job/[token]/files`; patterns through `PatternSource` (X5, wave 2) |
| Received / In production / Ready for QC | `job_packet_record`, moving the batch's orders |
| notes and photos | `recordNoteAction`, `/api/job/[token]/photos` |
| WhatsApp message | `lib/job-packet/notify.ts`, behind two env keys |
| signed, expiring, revocable | hashed random token, `expires_at`, `revoked_at`, rotate on resend |

## Token and upload threat model

- **A link that leaks** (a forwarded WhatsApp message, a shared phone) gives its holder that batch's lists and
  files and the ability to move its orders forward and add notes and photos. It gives no session, no other batch,
  no other brand, no price, no personal data beyond the names and numbers already on the factory sheet, and no
  storage address. Ops revokes it, or sends it again, which rotates the token.
- **Guessing a token**: 256 bits, so guessing is not a route. A guess costs a shape check in TypeScript and, if it
  passes, one indexed lookup, under the per-address limit.
- **A stolen database dump** holds hashes only, so no link in it can be opened.
- **Server logs and the host's own access logs**: the app scrubs `/job/<token>`; the host's access logs still hold
  live tokens in request paths, exactly as decision 0026 noted for `/s/*`. Set the host and monitoring to mask
  `/job/*` as well (left open, carried over from 0026).
- **A malicious upload** cannot be an SVG, a script, a polyglot or a zip bomb: the type is decided by the bytes,
  the file is re-encoded, and the size and pixel count are capped before and during decoding. It cannot be written
  outside its packet's folder, cannot overwrite a file (`upsert: false`), cannot be read by any member, and cannot
  be recorded without a key the database itself checks the shape of.
- **A flood** is held by the per-address limit, the per-packet limit, and the database's own 1000-event and
  200-photo ceilings; the body size is capped before it is read.
- **What the factory cannot do**: read or write another batch, see any brand's designs, hold or delay an order,
  pass QC, ship, change or remove anything it recorded, or learn whether a link it was given is unknown, expired
  or revoked.

## Alternatives

- **An account per factory.** Rejected for now: the spec is explicit that the factory has no account, and F-O2's
  acceptance test is about ops doing no manual work, not about the factory managing a password. Revisit when a
  factory wants several named people with separate histories (owner question 3).
- **A signed (JWT-style) token with no row.** Rejected: it cannot be revoked without a row anyway, and a signing
  key leak would open every link for its lifetime. A hashed row revokes in one UPDATE.
- **Letting the factory's buttons call the functions with the publishable key** (anonymous grants). Rejected for
  the same reason as decision 0026: the publishable key is public, so anyone holding a link could then call
  `job_packet_record` past the app's rate limits, and the limits are the only thing standing between one leaked
  link and a thousand events. Only the server calls them, after its own checks.
- **Storing the photo in the brand's folder**, so the existing file model covers it. Rejected: it would make a
  photo an unauthenticated writer can create visible to every member of that brand, and would need a brand id the
  packet does not name. A packet folder is outside every brand's reach.
- **Letting a step move an order from any status.** Rejected: the factory would be able to undo a hold or a delay.
  It moves only the orders standing at the step before, and says how many it moved.

## Dependencies

No new dependency. `fflate` (MIT) and `sharp` (Apache-2.0) are already in the repository and already used for the
ops print ZIP and for every uploaded image.

## Evidence

- `apps/web/lib/job-packet/*.test.ts` (173 tests, 100% of statements, branches, functions and lines in
  `lib/job-packet/**`): token shape and hashing, the rate key holding no token, step order, the step table matching
  `lib/ops/status.ts`, the schemas, the failure messages, the ZIP's determinism and path sanitising, the photo path
  and the EXIF strip proven on a real JPEG with EXIF written in, the notifier's stub-by-default and its two failure
  paths, the headers and the log scrubber.
- `apps/web/tests/integration/job-packets.test.ts` (25 tests): the hash only, the one-live-packet index, expiry and
  revocation, resend rotating the token and refusing another batch's packet, the three steps moving the batch's
  orders and writing `ops_order_events` with no actor, every illegal step, note and photo-key refusal, the service
  role holding only SELECT, `factory_events` refusing change through the API and through psql as the owner of the
  table, and no browser role being able to run any function or write either table. Written, not run in this
  branch: there is no Docker in the sandbox.
- `apps/web/tests/integration/isolation.test.ts`: both tables added to the platform-table list.
- `apps/web/e2e/job-packet.spec.ts`: ops makes a link on the batch page, the address is shown once, a browser with
  no session opens it (checking the headers), downloads the sheet and the ZIP, presses Received with a note, the
  order moves to "Received by the factory", ops sees the event, and the revoked address is 404. Written, not run in
  this branch.

## Owner questions

1. **How long should a link last by default?** 28 days is a labelled default, chosen to cover cut-off to QC. If the
   factory works to a different rhythm, say the number and it becomes a setting rather than a constant.
2. **Should the link be per batch or per factory?** It is per batch today, which keeps a leak to one batch. A
   factory with ten batches gets ten links and ten WhatsApp messages.
3. **Should a factory's reply name a person?** `factory_events` records no name, so the scorecard (F-O6) cannot
   tell two people at one factory apart. Add a free-text "who pressed it" box, or leave it?
4. **Who owns the WhatsApp Business number, and is a template message needed?** The adapter sends plain text,
   which the Cloud API allows only inside a 24-hour window the factory opened. Outside it, Meta requires an
   approved template. A first message to a factory that has not written to us may therefore be refused until a
   template is approved — ops then copies the link. Confirm the number and whether to apply for a template.
5. **Should the factory see prices?** It does not today: the page shows pieces, sizes, names and the BOM, never
   `value_minor`.
6. **Should a photo be kept forever?** There is no retention rule yet. Photos stay until the batch's orders are
   deleted, and nothing deletes them today.

## Consequences

The server's key is used on a page with no session, but only through the job packet functions and a file reader
fixed to the batch the token names. Writes from an unauthenticated holder now reach `ops_orders`, which is new; it
is bounded by the step machine, the "one step at a time" rule and the rate limits, and every move is in
`ops_order_events` with the note that a factory made it. Patterns are missing from the ZIP until X5 is wired in
(wave 2), and the README says so. Revisit when F-O3 (QC) wants the factory to submit measurements, and when F-O6
wants per-person attribution.

---

# 0072 revision 1: the job packet carries patterns (wave 2 prerequisite)

Status: Proposed. Date: 2026-10-30. Plan step: `plans/platform-v5.md`, the opening paragraph of "# Wave 2". No
migration.

Point 12 above left `PatternSource` as `noPatterns`. `apps/web/lib/job-packet/drafted-patterns.ts` now fills it
from the production package's own pattern writers (`lib/kpp/files/patterns.ts`, decision 0070) over the graded
drafter (decision 0068):

- A batch names a garment registry type in `batches.article_id`. The catalogue's map (decision 0066) turns that
  into a base article code, the drafter drafts it, and the ZIP's `patterns/` folder gets `dxf_aama/<code>_<size>.dxf`,
  `pdf_1to1/<code>_<size>.pdf` and `svg/<code>_<size>.svg` for every size the batch's orders ask for, plus one
  `dxf_aama/<code>_nest.dxf` of exactly those sizes.
- **Determinism.** Every file's date is the batch's cut-off, never the clock, and the ZIP's own times were
  already fixed, so the same batch and orders give the same bytes.
- **A source now answers with its files and the sentence the README carries**, rather than a standing note: the
  reason a folder is empty is specific to the batch. `PatternSource.filesFor` returns a `PatternSet`
  (`{ files, note }`), and `packetZip` passes that note straight to the README. Five sentences are possible: the
  folder's contents and what they were drafted with; the registry type is mapped to no base article yet; the
  article has no drafting script (the drafter's own words); the article does not grade the sizes asked for; no
  order in the batch asks for a size. Each ends by saying Knitwright sends the files separately.
- **What the README claims is only what is true.** The note says the files are the base article's graded block,
  drafted at the article's own default parameters, v-notch notches (owner decision 17: one notch style in the
  geometry, named in the files), and "a Knitwright draft for factory review, not a factory-checked master
  pattern" — which is the state owner decision 10 describes. A design that changed a structural parameter is
  not reflected, because a batch names the article, not a design's parameters; no design today sets any, since
  the Form that offers them is wave 2 work.
- `noPatterns` and `NO_PATTERNS_NOTE` stay exported and tested, as the source that adds nothing.

## Evidence

| Claim | Test |
|---|---|
| A DXF, a 1:1 PDF and an SVG per asked-for size, in grading order, and one nest | `lib/job-packet/drafted-patterns.test.ts` |
| The same batch and orders give the same bytes twice | `lib/job-packet/drafted-patterns.test.ts` |
| A type with no article, an article with no script, and a size the article does not grade each say so in words | `lib/job-packet/drafted-patterns.test.ts` |
| The DXF says it is a draft nobody has reviewed | `lib/job-packet/drafted-patterns.test.ts` |
