# 0073: Moderation and IP basics

Status: Proposed. The word list, the picture-hash distances and the strike count are Knitwright defaults, not reviewed by a
lawyer and not tuned on real uploads. Owner questions below.
Date: 2026-10-29
Plan step: platform v5, wave 1, X8 (`plans/platform-v5.md`). Spec: F-G1 (`docs/spec/02-features.md`), spec decision 7
(`docs/spec/01-product-direction.md`), the logo/trademark screening row of `docs/spec/05-architecture.md`.

## Context

F-G1 asks for one check on every upload, every AI generation and before every order: logo and trademark detection, text
screening of names and slogans, an offensive-content filter, a registry rights holders can add to and report through,
notice-and-takedown with a repeat-infringer policy, and a person's look before any Class B run. Spec decision 7 adds that a
product title holding "dupe", "inspired by <brand>" or a third-party brand name is blocked.

Decision 0025 already asks an uploader to state they own the artwork and keeps that statement on the file's row; a statement is
not a check. Decision 0055 compares a generated picture with the render it came from, which catches a warped crest, not a
borrowed one. Nothing until now looked at what artwork or words actually are.

## Decision

1. **A screening is a list of reasons, and the result is the worst of them.** `lib/moderation/types.ts`: a reason carries a
   code, a severity (`note`, `flag`, `block`), plain words, a `ruleId` and the word or mark that matched. `verdictOf` reads
   `blocked` from any blocking reason, `flagged` from any flag, else `clear`. A `note` records a check that could not run
   without holding anything back. **Every reason carries `R-GAP-000`**: the rulebook (X2) has no moderation entries yet, and
   the plan forbids inventing a rule's text. When X2 is merged these become real ids; the PR lists the gap.

2. **Three tables, read by platform admins only, written only by their own functions**
   (`supabase/migrations/20261101070000_moderation.sql`):
   - `moderation_checks`: one row per screening, with the automatic result, the reasons, and a person's decision once made.
     The automatic result never changes and the decision is made once; a trigger says so to the owner of the table too, and
     the grants hold the server to SELECT. A deleted account's id may be cleared from the row and nothing else; the rows go
     with the brand.
   - `rights_holder_marks`: the registry. A name, a 128-bit picture hash, or both. One row per name, whatever its case.
   - `takedown_notices`: reports from the public form and ops' decision. Upholding one names the brand and writes that
     brand's strike number at the time, counted under an advisory lock so two decisions cannot share a number.

   `moderation_record` refuses a result that does not match its reasons, and refuses a reason with no `code`, no `message` or
   no `ruleId`: the queue can never hold a finding that explains nothing.

3. **Text screening is pure, and where the words sit changes what they do** (`text.ts`). Text is normalised first
   (`normalise.ts`): accents dropped, lower case, the common character swaps undone (`N1ke`, `$hit`), then split into whole
   words. Matching is only ever by whole word or whole phrase, so Scunthorpe, Dickson, Cockburn, Penistone and Arsenault
   pass. A third-party name **blocks a product title** (spec decision 7) and only **flags** a name, a slogan, a file label or
   a prompt, because "Arsenal" can be a nickname or a club's own licensed name and a person should decide. "Dupe" and
   "inspired by <brand>" block in a title only.

4. **The offensive-word list is Knitwright's own** (`words.ts`): about 30 entries, written for this workstream, not copied
   from anywhere. **Licence: none needed — it is our own text, published under this repository's licence.** No MIT or CC0
   list was taken, so there is no third-party licence line to carry. Slurs and strong swearing block; words that are also
   names or ordinary words (Dick, Cock, Prick, Bastard, Bollocks, Piss, Tits, Nazi) only flag, for a person to decide. A few
   stems also match the start of a longer word where English team and player names give no innocent continuation.

5. **Picture screening is a perceptual hash plus a vision check** (`image.ts`, `image-hash.ts`, `vision.ts`). The hash is a
   128-bit difference hash: flattened on white, greyed, shrunk to 9 by 9, each pixel compared with the one to its right
   **and** the one below it, with a difference of 6 of 255 or less counting as no edge. Both details were measured, and both
   fix a hash that was wrong before:
   - comparing sideways only leaves a picture whose structure runs the other way (stripes across) with no bit set at all, so
     it cannot be told from plain white;
   - asking "is the left pixel brighter?" is a coin flip across the flat background most artwork sits on, and JPEG noise then
     flips those coins and moves the hash 8 bits or more.

   A hash with fewer than 12 of 128 bits set is **never compared, in either direction**: every flat picture is a perfect
   match to every other, so the answer would be noise. The marks route refuses to register such a picture, rather than
   keeping one that can never match.

   Distances `imageBlockDistance: 8` and `imageFlagDistance: 20` (`settings.ts`) sit in the measured gap: the same mark
   resized from 60 to 600 px, recoloured, or re-saved as a JPEG at quality 40 stayed within 2 bits; a different picture was
   52 bits away. **Knitwright defaults, not tuned on real uploads.**

   The vision half is the `VisionCheck` interface. `createStubVisionCheck` answers from a script and never reaches a network,
   and it is what every test and every browser test uses. `createModelVisionCheck` goes through the existing provider
   interface (`lib/providers/text-model.ts`) and its existing key, adding no vendor and no key of its own; it is wrapped in
   the usage meter (`metered.ts`), which reserves before the call and gives the cost back when it fails. **A check that could
   not run is not a pass**: no model configured is a `note`, a failed or refused call is a `flag`, and a person looks.

6. **Four hook points, as functions other code calls** (`hooks.ts`): `screenUpload`, `screenText`, `screenGeneration`,
   `screenBeforeOrder`, plus `assertHumanReviewed` for a Class B run. Only `screenUpload` is wired: `uploadArtwork` takes an
   optional `UploadGate` (`gate.ts`, four lines, the only thing the upload path imports) and the artwork route passes it. A
   blocked upload is refused before anything is stored, and the result is kept with no asset to point at; a clear or flagged
   one is stored and the result is kept against the new asset's id. A result that cannot be kept is logged and does not fail
   the upload, because the file is already stored; `screenBeforeOrder` then reads that asset as never screened and holds the
   order for a person. The other three hooks are wired in wave 2 (the orchestrator's X8-into-X4 step).

7. **A person's decision is "allowed" or "blocked", never "approved".** The repository's wording rule
   (`lib/ops/wording.test.ts`) forbids words that make something look settled, "approved" among them, and it is right to: the
   word is for a factory's sign-off, not for a moderator saying a crest may be printed.

8. **Ops review at `/ops/review`**: the queue of flagged and blocked checks nobody has decided, the notices, the strike count
   per brand, and the registry. Platform admins only; everyone else, signed in or not, gets the page that does not exist
   (Lessons 4, `requirePlatformAdmin`). Every decision needs a reason of up to 500 characters. Marks are added by name through
   a server action and by picture through `POST /ops/review/marks`, which keeps the hash and never the picture.

9. **A public report form at `/report-a-mark`** (`report.ts`): no account, guarded by the bot check like the existing public
   forms and limited per address by the `requestAccess` rule. Nothing the reporter links to is ever fetched; the link is kept
   as text for ops to read. The answer says only that the report arrived. No mail sender exists yet (owner action A4), so ops
   reads new notices on the review page and the server logs that one arrived.

10. **A short starting list of third-party names is seeded** (18 rows, `source: 'knitwright-default'`) so "Nike dupe" is
    caught on day one. It is labelled on the page as the Knitwright default list, not a licensed registry, and ops can switch
    any row off. `rights_mark_add` refuses to pass a new row off as part of that list.

No new dependency. `sharp` and `zod` are already in use.

## Evidence

Unit tests, 111 of them in `lib/moderation/*.test.ts`, at 100% of lines and 97% of branches: the hash's measured distances and
its two weaknesses; the false-positive list for text; every hook including the record that could not be kept; the store, the
review reads and writes against a fake client; the report form; the metered vision check. `lib/moderation/upload-path.test.ts`
drives the real `uploadArtwork` and shows a blocked upload leaves nothing in storage or in the tables.

Database tests, `tests/integration/moderation.test.ts`, written and **not run here** (no Docker in this sandbox; CI runs them):
the result-matches-reasons refusal, the rule-id refusal, the grants, row level security for a member and for the brand's own
owner, decide-once with a reason, the registry's rules, the strike count, and an owner-level block of the trigger through psql
in the database container, skipped where Docker is unreachable (the idiom of `append-only-owner.test.ts`).

Browser tests, `e2e/moderation.spec.ts`, written and not run here: the report form end to end, `/ops/review` answering 404 to a
signed-out visitor and to a member and 200 to a platform admin, and ops deciding a notice.

**No model was called at any point.** The vision check is an interface; the stub is what runs.

## Alternatives

- **A licensed profanity list** (LDNOOBW, `naughty-words`). Both are permissive, but both are long lists of bare words with no
  severity and no note of which entries are also surnames, which is exactly the judgement this needs. A short list we wrote,
  with a severity per word and a reason for each, is defensible; a long one we did not read is not.
- **A one-direction 64-bit dHash**, as first written. Measured: blind to structure that runs the wrong way, and 8 to 9 bits of
  drift on a re-saved JPEG, which is most of the distance to a different picture. Kept the idea, doubled the hash and made a
  tie a zero.
- **Blocking on the vision check's word.** A vision model naming a brand is a guess; it flags, and a person decides. Nothing a
  model says blocks on its own.
- **Blocking a third-party name everywhere.** It would refuse a club its own name. The title is where the spec asks for a
  block, and the title is where it blocks.
- **Keeping the mark's picture** so a better algorithm could re-score it later. Storing other people's logos to protect other
  people's logos is the wrong trade; only the hash is kept.
- **A boolean `reviewed` column on the asset.** Loses the history, the reasons and the reviewer, and cannot answer "has
  anything been flagged since a person looked?", which is the only question a Class B run needs.

## What this does not do

- **Three of the four hooks are not called by anything yet.** `screenText`, `screenGeneration` and `screenBeforeOrder` exist,
  are tested and are wired in wave 2. Until then only uploads are screened.
- **The hash does not survive a crop, a mirror, a rotation, or a mark placed small inside a bigger picture.** Those need the
  vision check, and the vision check only runs where a model key is set.
- **The word list is English only.** A name or slogan in another language passes.
- **The repeat-infringer count is a number on a page, not an action.** Nothing is suspended at three strikes; the policy that
  should follow is owner question 4.
- **There is no notice to the brand** whose artwork was reported or blocked, and no appeal, because no mail sender exists (A4).
- **A rights holder cannot register a mark themselves.** They report; ops adds the mark. The `rights-holder` source exists for
  when that changes.
- **Nothing was reviewed by a lawyer.** The report form's wording, the good-faith statement and the takedown flow are a
  working draft, not a DMCA or EU DSA process.

## Owner questions

1. A set of real uploads, good and bad, with the marks they should and should not match, so the two picture distances and the
   12-bit detail floor can be measured instead of guessed.
2. Should the offensive-word list be reviewed by somebody, and should a club be able to ask for a word on it to be allowed for
   their own name?
3. Which model should the vision check use, and should it run on every upload or only on artwork a person means to print? It
   is a paid call per upload today.
4. What happens at three upheld notices (the default): a warning, a stop on new orders, or an account closed? And who decides?
5. Does a Class B run need a person's look at the design version only, or at every picture in it as well?
6. The report form and the takedown flow need a lawyer's eye, and an address to send notices to.
