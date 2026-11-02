# 0116: The four HIGH findings of the v5 security review

Status: Proposed. All four are closed, each with a test that fails without the fix. H3 changes what blocks a factory
hand-off, which is a policy change, and owner question 1 below asks whether that block should be softer at launch.
Index: Proposed; H1 the garment lock's provenance moved to `public.files`, H2 the credit key digested, H3 moderation wired to every generation and order path with an unscreened target blocking the hand-off, H4 a viewer may not spend credits; three owner questions
Index title: The four HIGH findings of the v5 security review
Date: 2026-11-02
Plan step: none of its own. Closes the four HIGH findings of `docs/reviews/security-v5.md` (decision 0109, PR #147),
each of which that review deferred because it changes another workstream's design. Builds on decisions 0091 (the
launch shell and the garment lock), 0093 (AI scenes and shoots), 0094 (marketing studio), 0096 (flows), 0073
(moderation and IP), 0080 (the make flow), 0051 (credits) and 0066 (base articles).
Migration: `20261215010000_file_provenance.sql` and `20261215020000_credit_spend_ability.sql`.

## Context

The v5 security review found no CRITICAL finding and four HIGH. It fixed five MEDIUM and LOW findings in its own PR
and deferred all four HIGH ones, because each changes a workstream's design rather than a line of it: H1 needs a
column on `public.files` that every store site must then set, H2 needs a module boundary moved, H3 is a wiring
programme across about eight call sites with a policy question inside it, and H4 changes behaviour for every existing
paid path. The orchestrator decided each one. This record is what was decided and what was built.

The review's own reasoning is better than any summary of it and carries the file and line of every claim; read it
first. What follows says what changed.

## Decision

### 1. H1. A file's provenance is the file's own, and no request body may state it

**The finding.** The garment lock asks three questions. Two were always answered server-side and are airtight: *is
this board a kind a model draws?* comes from `boards.kind`, which is immutable after insert, and *is there a
generated board upstream?* comes from a recursive walk of `board_edges`. The third — *did this file come out of a
model?* — was `asset.provenance`, a `z.enum(["deterministic", "golden_sample", "generated"])` **in the request body**,
and `public.files` held no column that could answer instead: it classified by `kind` only, and a deterministic mockup
and an AI lifestyle image are **both** `kind: "render"`.

So a member with `manageKit` on their own brand could add a `design` board and a `mockup` board, connect them, read
any generated file id of the brand, and call `recordBoardOutputAction` with
`{ role: "print_file", provenance: "deterministic", fileId }`. All six enforcement points agreed, because every one
tested the board or the graph and none tested the file. `assetFrom` rebuilt the body's asset verbatim and cast past
the type system **on purpose**, on the premise that `acceptAsset` would refuse such an asset — and `acceptAsset` only
entered its refusal branch when the body *admitted* `"generated"`.

**What it did and did not buy.** It put no generated pixels into a factory print file: the print builder reads
artwork only from `user_artworks`, so a raw `files` uuid resolves to nothing and the layer is dropped. What it
defeated was the platform's own promise. The mandatory "AI-generated" label on the Store hand-off is computed from
graph topology, so a generated file sitting on a mockup board went out to the O2 contract with `label: null` — which
is exactly what `lib/flows/zip.ts` warns about in its own header.

**The decision: the server decides a file's provenance, and the client cannot state it.**

`public.files.provenance` is written by whatever stores the file, and takes one of three values:

| | what it means | who writes it |
|---|---|---|
| `deterministic` | our own code made these bytes from the design | the studio renders, the turntable's poster, the drafted DXF, the built print and roster files |
| `uploaded` | a person supplied the bytes, including copies our code derives from them | the artwork upload route, the artwork intake's three copies, size charts, strike-off photos, delivered patterns |
| `generated` | a model made them | the photoreal image model, the lifestyle generator, the AI clip |

`provenance` is required on `StoreImageInput` and on the writer's own `FileRecord`, so the compiler enumerates the
store sites rather than a reviewer having to. `saveWatermarked` takes it as an argument, because that one call serves
the deterministic studio renders *and* the model-made lifestyle pictures, which is the heart of the finding;
`provenanceOfMediaKind` in `lib/media/contract.ts` is the one place that decides which. The column's **default is
`generated`**, the restrictive value, so a store site that somehow writes a row without saying loses the right to use
its file as artwork rather than gaining it.

`provenance` is gone from `recordOutputBody` entirely. `recordOutput` reads it from the row, `acceptOffer` judges the
role against it, and the deliberate cast is gone with the field: `assetOffered` gives a generated file the role
`"scene"` outright, so the `SceneAsset` that comes out is one the compiler can check.
`lib/launch/garment-lock-provenance.test.ts` runs the attack body through the real schema and the real service and
watches it refused, and fails if a `provenance` field reappears in the launch or flow request schemas.

`AssetProvenance` gained `"uploaded"` so the asset layer can say what the file's row says without lying. The three
non-model values behave identically everywhere, which is the point: the only question the lock asks of a file is
whether a model made it. `golden_sample` stays an asset-level provenance and is **not** a column value — a photograph
becomes a golden sample's when it is attached to one, which `golden_sample_photos` records.

**The backfill.** Every existing row is judged by its kind, because the column did not exist when it was written.
Exactly one kind was ever written by a model-backed path — `render`, by the photoreal image model and by the media
service, which serves the deterministic studio renders and the AI lifestyle pictures through one call. A render
therefore cannot be told apart after the fact and keeps the strict default. Every other kind has only ever been
written by a path with no model in it, and each is named explicitly rather than swept up by an `else`, so a kind a
later release adds keeps the strict default until somebody decides what it is. This is the review's rule — *if you
cannot tell what made a row, it is `generated`* — applied as narrowly as the evidence allows, so that existing
artwork a brand uploaded does not stop being usable as artwork.

**The two routes the review named as sharing the root cause are closed the same way.**
`add_golden_sample_photo` checked only that the file belonged to the brand; it now takes `kind = 'photo'` and
refuses anything a model made, because a golden sample is a garment somebody held. The marketing lock, which
`lib/marketing/assets.ts` describes as shut "in three places" and which ran **only in the browser** — the chosen file
id is persisted as plain settings jsonb that `save_launch_board` validated with nothing but
`jsonb_typeof(p_settings) <> 'object'` — is now also in `save_launch_board`, which refuses a marketing board whose
`pictures` map names a file that is not the brand's or that a model made.

**And the label the finding actually defeated.** `listingPayload` takes the output files a model made, read from the
rows, and labels from either answer: what the graph says could have reached a board, or what the file's own row says
made it. The topology answer is sound again now that a generated file cannot be recorded on a board the platform
draws, so this is the belt beside that brace — and it is the answer the review asked for.

The review also notes `fix/v5-wave4-wiring` as a fifth store site that hard-codes `provenance: "deterministic"` for
every board's output file. That file (`components/launch/marketing-services.ts`) is not in `main`; nothing supplies
the marketing panel's picture list yet, and `OfferedPicture` already carries a provenance, so whoever wires it reads
the file's row like everything else now does.

### 2. H2. A run's credit line is keyed on a digest of the whole prompt

`idempotencyKeyOf` joined the board id and fourteen fields and then cut the result to 200 characters, to fit the
ledger's own check on `p_output_key`. The prefix is roughly 120 to 170 characters of board id and short fields, so
most of the prompt was discarded and **all** of it was once `backgroundText` was long. Pad the background, vary only
the prompt, and the first shoot was charged and every later, genuinely different shoot found the key already in
`credit_ledger` and came back `charged: false`. Unlimited free paid generations once `CREDITS_ENFORCED` is on.

The key is now `shoot:` plus a sha256 of the board id and the whole settings record — nothing discarded, nothing that
can be padded out of it. `credit_spend_output` keys the same way and says why in its own comment. Taking the digest of
the settings **record** rather than of a hand-written list of fields also means a field a later release adds is in the
key the day it is added; `conceptSlug` and `backgroundFileId` were both missing from the old list.

It moved to `lib/shoots/board-key.ts` because it needs `node:crypto` and three client components import
`lib/shoots/index.ts`, which re-exports `./board`. The barrel does not re-export the new file — the convention its own
header already states — and a test beside the key holds that, as well as the review's own test of whether the widened
client-boundary rule in PR #147 was worth adding.

### 3. H3. Moderation is called at the points the spec names, and an unscreened target holds the hand-off

`screenGeneration`, `screenBeforeOrder` and `assertHumanReviewed` were implemented, tested and called from nowhere in
production: one upload path of about eight, no generation path of five, no order path of two. The spec is one sentence
— "on every upload, every AI generation and before every order" — and this was plan task 4's deliberate minimum with
wave 2's wiring never done.

`lib/moderation/gate.ts` now holds the narrow ports the rest of the product imports, and `server.ts` binds them to the
brand, the person and a route for the usage meter, so a calling path cannot get those wrong and cannot reach a model
by accident.

**Every generation path screens, between the model and the store, so nothing a review blocks is kept.** The photoreal
front and back, each view against the job's own row, with a block failing the job and refunding. The media set's
lifestyle pictures — and only the kinds a model made, because a studio render is drawn from the design by our own code
and is no more an AI generation than a tech pack is; the whole set fails rather than one picture being dropped, since
a set with a hole in it is worse than none. The AI clip, on the poster it is made from, which is the frame also stored
as a file of the brand. The inspiration board's mood image, which is never stored, so its result is kept against a
fresh generation id and a block drops the card and gives the cost back. The fifth, `lib/shoots/run.ts`, already called
the hook through its own port; its runner still has no production caller, which is wave 6's work.

**Every order path screens, and a Class B run needs a person.** `lib/moderation/before-order.ts` holds the two calls
in the one order that is correct: `screenBeforeOrder` first and `assertHumanReviewed` second, because
`moderation_human_allowed` is true only while nothing newer is flagged, so a flag the screen records now must be able
to invalidate an allowance a person gave earlier. The make flow's three ways out — a sample request, a run, and the
order modal's one order per product — go through it immediately before `submitMakeOrder`, after every cheaper refusal
so a person is told the easy things first; the brand workspace's run goes through it before `submitRun`.

**The id a human review is about is the frozen release**, not the design version number. A release is a uuid, it is
what a factory is actually sent, and both order paths already carry it, so the ops reviewer's decision and the check
are always about the same thing. The alternative, `spec_versions.id`, is the more natural reading of "a design
version" but neither order path carries it, and a mismatch between what the screen records and what the reviewer
decides on would mean `humanAllowed` never matched. Owner question 3 below.

**The Store hand-off's title is screened.** It was free text from the body written straight into the listing payload,
while `lib/moderation/text.ts` already implemented the spec's one named block rule for exactly that context: "dupe",
"inspired by \<mark\>" and another brand's name in a product title are all blocks. "Nike dupe hoodie" shipped. A
flagged title is not refused — the hand-off is not a publication, and the flag sits in the ops queue.

**The two unscreened upload paths are closed at the type level.** `screen` was an optional argument on
`uploadArtwork` with no default, and that is the mechanism by which they skipped the screen silently: the design
import's derived store called it with three arguments and stored up to eight crests, sponsors and badges cut out of a
person's picture, and the artwork change path inherited the original's rights confirmation but not its moderation
verdict, so a flagged upload could be laundered into a clean-looking asset. It is required now, and the change path
screens the new picture rather than inheriting a verdict about the old one — the white box removed or the picture made
seamless is new pixels the registry and the vision check have never seen.

**An unscreened target holds "Ready for the factory" shut.** This is the policy half. `live-ports` dropped a target
with no stored screening from the answer, so `moderationClear` raised nothing and F-G2's "moderation status clear"
held for content nobody had ever looked at: a check that never ran was reported as a pass (the review's M9, which it
also deferred). The port says `pending` now — a value already in the vocabulary, with `moderation-pending` already a
rule id — and `UNSCREENED_BLOCKS_HANDOFF` in `lib/validation/checks/moderation.ts` makes that a **blocker** that
names which picture is unscreened and what to do about it, with its rule id.

**What now blocks, plainly.** A design whose artwork has no stored moderation check cannot reach "Ready for the
factory" and cannot be ordered: the readiness list refuses, naming each unscreened picture. Every brand's existing
artwork is in that state, because until this change almost nothing was screened — so on the day this ships, a brand
with artwork uploaded through any path but `POST /api/artwork` has to upload it again to send it for review. That is
the restrictive answer and it is the right default for a gate that exists to keep unmoderated artwork out of a
factory, but it is a real cost and it is the owner's to weigh. Owner question 1.

Three paths of the roughly ten that store a picture are still unscreened, each because there is no picture to screen
or no model in it: a size chart and a pattern DXF have only a label, and the factory's job-packet photo arrives on a
token-authenticated public route with no session to meter a vision call against. They are named here rather than left
to be found again.

### 4. H4. A viewer may not spend the brand's credits

`public.credit_spend` asked `private.belongs_to`, which is true for every membership row including a viewer's, while
the v5 flows function states the opposite policy verbatim and applies it to the new path only: "`credit_spend` asks
only for membership; a viewer should not be able to spend." Every credit-gated route is `auth: "member"` with no
ability check of its own, so a viewer — someone the product describes as unable to change anything — could empty the
balance through any pre-v5 paid path. This is v4's M2 reopened: v4 left it as an owner decision, and v5 wrote the
decision down in a migration comment without applying it.

`credit_spend` now asks `private.can_manage_kit` and raises `42501`, matching `credit_spend_output`.
`create or replace` at the same signature keeps the grants of 20261025060000, and `can_manage_kit` reads the same
membership row and then the role, so it strictly implies `belongs_to` and this can only narrow who may spend.

A viewer on a credit-gated route now gets a raw refusal rather than a sentence, because those routes carry no
`requireAbility` of their own. Adding one to each is a separate, cosmetic change and is deliberately not in this PR:
`CREDITS_ENFORCED` is off, so nothing is charged and nobody sees it yet.

## Owner questions

1. **Should an unscreened target block "Ready for the factory", or warn?** It blocks
   (`UNSCREENED_BLOCKS_HANDOFF = true`). Shipping unmoderated artwork to a factory is precisely the risk X8 exists to
   prevent, so the strict answer is the right default — but every existing picture is unscreened, so on the day this
   ships a brand has to re-upload artwork to clear the gate. Setting that constant to `false` makes it a warning
   instead; it is one line, it changes the severity of that one finding and nothing else, and the test holds both
   answers. This is the review's own M9 question, answered for now in the strict direction.
2. **Is the moderation wiring now complete enough for launch, or is the rest of it wave 6 with a date?** Every
   generation path, both order paths, the Class B review and the two laundering upload paths are wired here. The three
   label-only or sessionless upload paths named above are not, and `runShoot` and the flow engine's capabilities still
   have no production caller to screen. The review's own question was whether the single delivered upload path was the
   accepted scope for launch; it no longer is, and what is left is small and named.
3. **Is the frozen release the right thing for a human review to be about, or should it be the design version?** The
   release is what is used, for the reasons above. If the ops queue should instead review a design version across all
   its releases, that is one change in `before-order.ts` and the reviewer's own queue, not a rewrite.

## Consequences

* `public.files` has a required `provenance`, so every future store site must say what made its file. The compiler
  asks: `provenance` is required on `StoreImageInput` and on the writer's `FileRecord`.
* Three request bodies lost a field (`recordOutputBody`'s `provenance`) and four functions gained a required argument
  (`uploadArtwork`, `changeArtwork`, `createDerivedStore`, `placeOrder`). Each was a path that could skip a check
  silently; none can now.
* A design with unscreened artwork cannot be ordered. See owner question 1.
* A viewer cannot spend credits on any path, pre-v5 or v5.
* The `MEDIUM` and `LOW` findings of the review are untouched and still open. This record closes the four HIGH ones
  only.
