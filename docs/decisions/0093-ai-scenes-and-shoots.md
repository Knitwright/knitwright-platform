# 0093: AI scenes and shoots with the garment locked (L3)

Index title: AI scenes and shoots
Index: Proposed; no model preset has a licence on file so none can be used, every credit figure is a labelled placeholder, owner questions listed
Status: Proposed; no model preset has a licence on file so none can be used, every credit figure is a labelled
placeholder, the picture checker's thresholds are still untuned, owner questions listed
Date: 2026-11-02
Plan step: platform-v5 L3 (spec F-L1's AI part, the Launch section of `docs/spec/02-features.md`, and
`docs/spec/07-template-library.md`). Builds on 0091 (launch shell and boards), 0092 (mockup studio), 0055
(`lib/media-check`), 0057 (lifestyle pictures), 0073 (moderation), 0012 (usage metering) and the credits ledger.

## Context

F-L1 has two halves. L2 built the free half: the garment the platform **drew**, in a scene the platform **paints**. This
workstream is the paid half: the same garment, in a place a model **lights**. The one big difference from Kittl the spec
names is ours to hold — "in Kittl, AI boards re-draw the product, so it can drift. In Knitwright **the garment is always
locked**" — and the plan says this is the workstream most able to do real harm, for three reasons that have nothing to do
with code quality: a generated picture could be passed off as artwork, a person's likeness could be generated with no
licence or consent behind it, and money could be taken for a picture that was never kept.

Four things were already true and are built on rather than around:

* the 20 photographic scenes of `07` are already rows — L2 seeded them as `templates` of kind `mockup_scene`, each one
  marked `owner: "L3"`, and `composeMockup` refuses one by name rather than half-drawing it;
* `lib/launch/assets.ts` makes a generated picture unwriteable as artwork in the type system, at the seam and in the
  database, and L6 added three triggers because a four-hop chain could defeat all three;
* `lib/media-check` already measures a generated picture against the deterministic render, crest, sponsor, number,
  panel positions and colour ΔE included;
* `lib/media/lifestyle` already holds a family of adapters that put a locked garment into a scene, each behind its own
  key, and `lib/media/video` already solved the same problems for a clip — a model catalogue as rows, a commercial
  licence as a fact rather than a default, frame sampling, and a refund on failure.

## Decision

1. **A shoot idea is a bundle of L2's scene rows, and there are twelve of them.** `07` has no table of shoot concepts:
   it has a table of mockup scenes, 20 of which are photographic. So `lib/shoots/concepts.ts` holds twelve plans, each
   naming the scene slugs it shoots, and every other field is **read off those rows** — the light, the sports, the
   moods, the poses and the cameras. `sceneCoverage` proves in a test that the twelve account for all 20 scenes, once
   each. Inventing a scene, a place or a light would be inventing content the spec does not contain.
2. **The pose and camera presets have two sources and each row says which.** `spec`: the five poses F-L1 names. `scene`:
   every pose and camera the 20 scenes already name in their own slots. A camera preset has no other source, because the
   spec names the picker and leaves the list to the scenes. A pose derived from a scene inherits that scene's people
   band, which is what lets a garment-only shoot need no model and so no licence.
3. **A model preset carries a licence reference, and a preset with none cannot be run.** `licenceRef` is
   `string | null`; the references are two platform settings an admin fills at /admin/settings; the seed never writes
   one, so running it again can neither grant nor undo a licence. No row names a person, no row holds a photograph, and
   the migration has no column one could arrive in. The six seeded rows describe the body types, age bands and skin
   tones F-L1 asks the library to cover and say plainly that nobody has licensed one.
4. **A consented upload records the consent: a reference, the words that were ticked, and when.** All three or nothing,
   in `consentFrom`, in the panel and in the database (`shoot_jobs_an_upload_records_its_consent`). Half a consent is no
   consent. The statement is kept with the record so what was agreed to is not re-worded later.
5. **The garment lock is structural in four places.** `offerAsset` takes a `LaunchAsset` and `shootSceneAsset` returns a
   `SceneAsset`, whose role is the literal `"scene"`; `acceptAsset` refuses the same value at runtime; `shoot_jobs`
   has a NOT NULL `design_board_id`; and `start_shoot_job` asks L1's own `private.launch_board_has_design` rather than a
   second question of its own. This workstream writes no board output: a picture reaches a board through L1's one
   writer. A test proves a generated picture cannot be typed, written or accepted as a panel layer or a print file.
6. **The provider is an interface, and the real one is an existing adapter.** `ShootProvider` has no field for drawing a
   garment, and the prompt's last sentence is the garment lock, after everything a person typed. `adapter.ts` maps the
   request onto `LifestyleRequest` so the Photoroom, FASHN, Google and fal adapters of decision 0057 are used and no
   second family is written; their four scene ids are coarser than `07`'s twenty, so a scene's group picks the nearest
   and `SCENE_MAPPING_NOTE` says so on the record. `chooseShootProvider` gives the deterministic stub unless
   `MEDIA_SHOOTS_LIVE` is exactly "true" **and** a provider is configured with its key, so CI, a local run and every
   test call nothing.
7. **The stub is honest about being a stub.** It puts the locked garment on a plain shade of its own and marks the file
   as AI generated with `labelAsAi`, the same function the existing lifestyle pictures use. It draws no person, no room
   and no light, because a stub that pretended to be a photograph would be a worse lie than a plain backdrop. Because
   the garment is left exactly where it was, the real picture checker keeps the result — which is what makes all 20
   scenes work end to end today without a paid call.
8. **One run, one charge, and every door out refunds.** `runShoot` reserves the platform's own spend (decision 0012),
   charges the brand only when `CREDITS_ENFORCED` is on, calls the model, screens the picture and the prompt through
   X8's `screenGeneration`, and measures the garment with `lib/media-check`. A result the checker turns away is
   generated **once more** (F-L1) on the same credit key, so the retry cannot charge again, while the platform's own
   spend is reserved a second time because that call really costs the platform. A refused call, a blocked picture, a
   cap, a garment that drifted twice, a refund that itself fails — all of them come out through one `settle`, and the
   sentence the person reads says what happened to the money. The failure sentence is F-L1's own, word for word:
   "Couldn't keep your garment accurate, try another pose".
9. **The cost is on the button, and no number is written down here.** The credits for one picture come from the
   platform's own credit prices through L1's `LaunchCostSource`, and that source carries the credits page's notice
   saying the prices are placeholders. The button says "Generate 4 images (4 credits)". While charging is off the panel
   says so and still shows the cost, because the behaviour has to be right for the day it goes on.
10. **The image modal's edits are limited to the scene, twice.** A prompt that names the garment's own vocabulary is
    refused with a sentence that says where the garment is changed instead; an edit area that overlaps the garment's
    slot is refused. There is no action in the modal that makes the picture artwork, and the screen says so.
11. **Four tables, and the refund is L6's.** `shoot_concepts`, `shoot_poses`, `model_presets` and `shoot_jobs`
    (migration `20261201020000_shoots.sql`). The three library tables are platform data: every signed-in member reads
    them, only the server seed writes them. `shoot_jobs` gives the service role SELECT only; the two SECURITY DEFINER
    functions are the only writers and each checks `can_manage_kit`. Nothing here moves money: `credit_refund_spend`
    (decision 0096) is the one refund, and `shoot_jobs_refund_only_on_a_failure` refuses a row that claims one on a
    shoot that worked.
12. **The panels are two default exports taking `LaunchPanelProps`** — `ai-image` on the rail and `board-ai-image` for
    a selected board — and every change is a request to the shell. What they draw is decided in `panel-model.ts`, which
    a test reads with no shell and no browser.

## Evidence

* `pnpm --filter web exec vitest run --project unit lib/shoots components/shoots`: 263 tests pass.
* Coverage of `lib/shoots`: 99.4% of statements, 95.4% of branches, 98.9% of functions, 99.8% of lines (the threshold
  for the directory is 90%).
* `lib/shoots/works.test.ts` runs **all twenty** of `07`'s AI scenes through the whole paid path — meter, ledger,
  moderation, provider, picture checker — on the deterministic stub, and each comes back kept, on the first attempt,
  with the label the spec puts on it.
* `lib/shoots/run.test.ts` walks every door out of a run: a capped meter on the first call and between the two
  attempts, a balance that cannot cover it, a refused model, a blocked picture, a garment that drifted twice, a provider
  that throws, a refund that itself fails, and a reservation that cannot be released.
* `lib/shoots/check.test.ts` measures a clean picture, a moved garment, a missing crest and restyled colours through the
  real `lib/media-check`.
* `lib/shoots/migration.test.ts` holds the SQL and the TypeScript to the same lists, and reads the three promises of
  this workstream out of the migration by constraint name.
* `tests/integration/shoots.test.ts` (CI runs it) covers the grants, the row level security, the garment lock, the
  licence refusal, the consent constraint and the refund rules against the real database.
* `pnpm --filter web typecheck` and `pnpm --filter web lint` are clean, including
  `tests/architecture/client-weight.test.ts`: the panels carry no zod into the browser.

## Not verified

* **No paid provider has been called.** Every number about a real generation — how long it takes, how often the checker
  keeps one, what it costs — is unmeasured. F-L1's acceptance test ("4 AI images in under 3 minutes, at least 3 of 4
  passing the checker first time") is met on the stub only, which proves the path and not the model.
* The picture checker's thresholds are still the untuned Knitwright defaults of decision 0055.
* The mapping from `07`'s twenty scenes onto the four scene ids those adapters know has not been looked at by anyone
  with an eye for pictures.
* The styles, the pose prompts and the estimated waiting times are placeholders nobody has reviewed.
* The database tests and the browser tests have not been run locally (the shared local Supabase is the orchestrator's);
  CI runs the database tests.

## Alternatives

* **A model list of our own, like L5's video models.** Rejected: the wave 4 preamble says paid generation goes through
  the existing `lib/media/lifestyle` adapters, and a second family of HTTP clients would be a second thing to keep
  right. The cost of following it is the coarse scene mapping, which is written down and labelled.
* **Seeding twelve concepts with scenes, lights and poses of our own.** Rejected: `07` names the scenes, and content the
  spec does not contain is content nobody has reviewed.
* **Shipping model presets with an assumed licence, or hiding them until one exists.** Rejected both ways: an assumed
  licence is the one thing this workstream must never do, and hiding the presets would hide from the owner what the
  library needs. They are shown, unusable, with the reason on the card.
* **Charging for the automatic second attempt.** Rejected: the person asked for one picture. The retry runs on the same
  credit key, so the ledger cannot charge twice even if a caller tried.
* **A stub that drew a room and a person.** Rejected: a convincing fake of a photograph is a lie, and this product is
  built on not telling that kind of lie.

## Consequences

* All twenty AI scenes have a working path today, and two of them (the changing-room layout and the kit on a bench,
  plus the shop rail) need nobody in the picture, so they can be run with no licence and no consent at all. The other
  seventeen need either a licensed preset — none exists yet — or the brand's own model with a recorded consent.
* `CREDITS_ENFORCED` turning on changes no code here: the ledger stops being null.
* An owner filling the two licence settings makes presets usable with no deploy.
* A panel of this workstream is not mounted yet: a separate wiring change mounts wave 4's panels into L1's shell.

## Dependencies

No new dependency. This workstream uses what the app already carries: React, Next.js, Tailwind, zod (server side only —
the panels import no module holding a schema, which `tests/architecture/client-weight.test.ts` enforces), `sharp`
(through `lib/media-check` and the stub) and `@supabase/supabase-js`. Every one is already in the lock file under MIT or
Apache-2.0. No font, photograph, texture or third-party image is committed: every fixture is drawn from an SVG in
`lib/media-check/fixtures/synthetic.ts`.

## Owner questions

1. **Which AI model presets may be offered, and what licence reference do we hold for each?** Nothing can be generated
   with a person in it from a preset until this is answered. The spec asks for "licensed AI presets with diverse body
   types, ages and skin tones"; the six seeded rows describe that range and hold no licence. **This is a question the
   questionnaire does not yet ask** — the two settings carry question 35 (the nearest, about pictures of people), and a
   question of its own is owed.
2. **What does one AI picture cost, in credits?** It is the `credits.price_marketing_media` placeholder of 1 credit,
   which is not a price. Question 1 of the questionnaire, and it is money.
3. **What wording should a brand tick when it uploads its own model, and what proof must it hold?** Ours is a draft
   (`CONSENT_STATEMENT`) and it should be read by a lawyer before anybody relies on it.
4. **Which of the picture providers should be used for shoots, and at what spend cap?** Four exist behind their own
   keys and none has been called for a shoot. `MEDIA_SHOOTS_LIVE` is off.
5. **Which style belongs to which shoot?** F-L1 names five styles and `07` says nothing about which shoot uses which,
   so the mapping is a Knitwright default and every concept's note says so.
6. **How many poses should a garment-only shoot offer?** `07` asks each shoot for three to six and the changing-room
   scenes name one between them. The gap is on the screen rather than filled in.
7. **Should the automatic second attempt be at the platform's expense?** It is today: the brand is charged once, and
   the platform pays for both model calls. That is money, so it is the owner's to overturn.
8. **Should a flagged picture be usable in a listing before a person has looked at it?** It is shown to the brand and
   marked as waiting for review today; X8's queue decides the rest.

## R-GAP-000

No rulebook entry covers the shoot studio, so everything this workstream produces carries `R-GAP-000`: every shoot
idea, pose, camera and model preset row; every refusal in `verdict.ts`; every finding of the checker as this directory
reports it; the two gaps shown on screen (the pose count `07` asks for, and the modal's tools belonging to the shell);
and the `rule_id` default of all four tables. A rulebook entry for the garment lock, for what a picture checker's
thresholds mean and for what may be generated of a person is owed by whoever owns the rulebook (X2).
