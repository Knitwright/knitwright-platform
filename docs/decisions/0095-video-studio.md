# 0095: The video studio (L5)

Status: Proposed; the encoder is the browser recorder until a deploy target with ffmpeg exists, every credit figure and
every model row is a labelled placeholder, owner questions listed
Date: 2026-11-02
Plan step: platform-v5 L5 (spec F-L3, `docs/spec/07-template-library.md` video templates). Builds on 0091 (launch shell
and the panel contract), 0058 (turntable recording and the image-to-video clip), 0055 (the generated-picture checker),
0054 (media sets), 0044 and 0051 (credits), 0070 (the files-service seam).

## Context

F-L3 asks for two different things under one name. The first is four **free, deterministic** videos made from the 3D
render -- a 6 second turntable, a 4 second front-to-back flip, an 8 second kit reveal and a 9 second home/away/GK
carousel -- exported as MP4 at 9:16, 1:1 and 16:9, 1080p. The second is an **AI video board** on the launch canvas:
first and end frame, eight sportswear prompt presets, a model picker configured in admin with credits per second and a
commercial-licence flag, an aspect, 3 to 15 seconds, and sound. On top of both sit the twelve video templates of `07`,
with text burned into the picture.

Three rules cut across all of it. The garment is always locked, so every frame starts from the picture the platform
drew. Because the output is a video rather than a picture, **the checker has to sample frames**, not just the first one.
And money has to be honest: the cost is shown before a run, a paid call is metered, and a run that fails is refunded.

Two things already existed and are extended rather than rebuilt: `lib/media/video/**` (the turntable recorder, the clip,
the fal adapter, the stub, the storage paths) and `lib/media-check/**` (the checker).

## Decision

1. **The encoder is the browser recorder. The ffmpeg path is a command and a seam, not a process.**

   The plan asked for server-side ffmpeg "if it is available in the deploy target". **The deploy target could not be
   established.** `apps/web/vercel.json` pins a region and nothing else; no deployment of this platform exists (owner
   action A1 is still open); and decision 0002 is still open on the host's own function time limit. A Node function on a
   serverless host has no ffmpeg binary unless one is bundled with it, which would mean committing a third-party binary
   -- which this plan forbids -- and answering a licence question nobody has answered.

   So the default is the option that works everywhere: the browser records the 3D canvas, as the turntable has since
   decision 0058. `chooseEncoder` picks ffmpeg only when `MEDIA_VIDEO_FFMPEG` names a binary, which no environment sets.
   `ffmpegCommand` builds the argv from a `RenderPlan` and its test asserts the argv; `FfmpegRunner` is the one-method
   seam a later workstream implements against a target that really has one. **Nothing in this change spawns a process**:
   `encoder.test.ts` reads every file in `lib/media/video` and fails on `child_process`, `execFile`, `execSync` or
   `spawn(`.

   **ffmpeg's licence**, as the plan asked: ffmpeg is LGPL-2.1-or-later, and GPL-2.0-or-later when built with
   `--enable-gpl`. The platform's dependency rule is MIT, Apache or BSD, so **no ffmpeg build is committed, bundled or
   redistributed by this repository**; the command would invoke a binary a deploy target already provides. That is
   exactly why the decision cannot be "bundle ffmpeg", and it is the owner's to revisit with a real target.

   The spec asks for MP4. `RECORDER_MIME_TYPES` asks the browser for MP4 first and falls back to WebM, and a WebM file
   **says so in words** ("Your browser can only record WebM...") rather than being handed over as if it were an MP4.

2. **One deterministic plan, and everything draws from it.** `sequences.ts` holds the four videos as rows of **shots**,
   each with what the camera does, which kit is on screen and what it is pointed at; `shot-plan.ts` turns a sequence and
   an aspect into a timeline with the camera at any moment, honest per-shot progress, the burned-in text as shares of the
   canvas, and the moments the checker samples. The same design, sequence, aspect and words always give the same plan, so
   the same video -- which is what "deterministic" has to mean. **No test renders a video**: the tests assert the plan,
   or the command built from it.

3. **The 3D view answers for itself, and a video it cannot record is not offered.** The viewers answer one event today
   (`knitwright:turn`, decision 0058), which turns the garment. A flip, a kit reveal and a carousel need a camera that
   can be pointed and a colourway that can be swapped, so the recorder **asks first**: it dispatches
   `knitwright:video-capabilities` with a reply function, and whatever the view puts there is what it can do. A view that
   answers nothing can only turn. A sequence it cannot record is shown **disabled, with the sentence that says why** --
   never recorded as something that is not the video the person asked for, and never quietly hidden. One listener each in
   `components/garment3d/scene.ts` and `components/gltf/scene.ts` turns the other three on; those files are not this
   workstream's, so the PR says so.

4. **The checker samples frames, and one bad frame rejects the clip.** `frame-check.ts` runs `checkGeneration` on every
   sampled frame against the garment-locked first frame, and the clip's verdict is the worst of them. The report says at
   which moment it drifted, and the sentence the person reads names that moment ("The garment changed part way through
   the clip (at 00:04)..."). A frame the checker could not read at all counts as a rejection, never as a pass, and a clip
   that gave back fewer frames than were asked for is turned away. How many frames is a platform setting, not a literal.

   **The frames are taken in the browser**, with a `<video>` element and a canvas (`components/video/sample-frames.ts`),
   for the same reason the encoder is the browser: reading frames out of an MP4 needs a decoder, and the deploy target
   has none. The PNGs go up with the clip and the server measures them.

5. **Money is honest, and the behaviour with charging on is the behaviour that is written.** `run.ts` reserves the
   platform's own estimated spend from the usage meter, charges the brand's credits **only when charging is on**
   (`CREDITS_ENFORCED` is off today, so `ledger` is null and nothing is charged), calls the model, samples and checks the
   frames, and **on every failure after the charge gives the credits back and releases the reservation**. Every door out
   goes through one `settle`, so there is no path that spends and does not refund; `run.test.ts` walks each of them,
   including a refund that itself fails.

   The cost is shown before anything is spent: `videoCost` is the words on the Generate button, and a model nobody has
   priced **cannot be run** -- the button says so instead of showing a number nobody chose.

6. **The model list, its prices and its licences are data a platform admin sets.** Four settings in the existing `media`
   group, registered through `lib/settings/extensions.ts`: which models are offered, credits a second by model, which
   models hold a commercial licence, and how many frames the checker samples. The catalogue in `models.ts` is the
   labelled placeholder that stands in until the owner answers: it names the four candidates the spec's architecture page
   lists (Kling, Veo, Wan, Seedance, "confirm licences"), claims **no commercial licence for any of them**, and every row
   says it was not reviewed by anyone. `licenceLabel` puts "Commercial licence not confirmed" on the button of every
   model an admin has not listed, which is all of them today.

7. **The garment can never be redrawn, and a clip can never be artwork.** Every prompt ends with one
   `GARMENT_LOCK_SENTENCE` appended from one place, so there is no preset and no typed request that reaches a model
   without it; `prompt-presets.test.ts` checks all eight. The provider's request has a required `firstFrame` and no field
   for "draw the garment", so a provider cannot be asked for one. `videoSceneAsset` returns a `SceneAsset`, whose role is
   the literal `"scene"`, so a finished clip **cannot be written down** as a panel layer or a print file;
   `ai-board.test.ts` casts past the compiler and watches L1's second door shut too.

8. **No live paid call from a test or from this workstream's own run.** The board provider is an interface with a
   deterministic stub (the same header-only WebM the clip's stub makes, which says "AI generated" inside and is not a
   playable video). The fal adapter is extended for the board's own fields and is returned **only** when `FAL_KEY` is set
   AND `MEDIA_VIDEO_LIVE` is exactly `"true"`. Its test uses a fake `fetch`; nothing here has ever been called live.

9. **The twelve video templates are rows, four of them real and eight of them honest.** Each row carries the length and
   source `07` gives it. The four built on a deterministic sequence work now; the other eight say plainly what they are
   waiting for (a marketing artboard, L4; the info card's size chart and callouts, L6; the brand's logo and type, L7; or
   a clip from the AI video board itself), and `templatePlan` returns **null** for them rather than a plan that draws
   nothing. A text slot refuses text past its limit with the limit in the message.

   They are **not** `templates` table rows of kind `video`: that table is parsed against the design shape, so seeding
   them needs `loadLibrary` narrowed to `kind = 'design'` in the same change, and that file is L8's (the note L1 left in
   `panels.ts`). The rows sit in this workstream's own directory until then.

10. **No third-party asset is committed, and no audio file exists.** No stock footage, no music, no font, no model. Text
    is burned in with the app's own font stack in the browser; the ffmpeg path burns text only when the deploy target
    provides a font file (`MEDIA_VIDEO_FONT`), and with none there is simply no text filter. **The Audio switch asks the
    model for a soundtrack of its own**; the platform ships no music, so there is no music licence to name. A model that
    makes no sound has the switch off with the reason on screen. If the owner later wants a music library, that is a
    licence decision and a new record.

11. **The waiting is the design.** Video is the slowest thing in the product, so: three empty states that each name one
    action; stages that say which part is happening (asking the model, taking frames out, checking every frame, saving)
    with a clock of **what has really passed** and a bar that can never reach the end before the work does, and that says
    when a model has gone past its own estimate rather than hiding it; an error state that says what happened, that a
    failed run is not charged, and what to try next; a player that never autoplays with sound and does everything from
    the keyboard. Secondary text is `text-ink-2` throughout, following L1's axe finding against `text-chalk-muted` on
    glass.

## Evidence

* `apps/web/lib/media/video/**`: 203 tests over the formats and the refusal of a length outside them, the four
  sequences and their shots, the plan and the sampling moments, the encoder choice and the ffmpeg argv, the eight
  presets and the garment lock in each, the model list and its settings, the board's settings and every refusal in
  order, the frame checker, the money, the board provider and the twelve templates. 98.7% of statements, 96.4% of
  branches, 96.6% of functions, 99% of lines (`lib/media/**` is held to 90%).
* `apps/web/components/video/**`: 91 tests over the panel's view against `panelDouble()`, the progress, the player, the
  recorder's commands and the browser frame sampling, plus the words and the markup read as a whole.
* `frame-check.test.ts` runs the **real** checker over the synthetic jersey fixtures: a clip whose frames are all the
  drawn garment passes, and one that is recoloured half way through is caught at the moment it changes while its first
  frame still passes. That is the evidence for "the checker samples frames".
* The spec read rather than remembered: F-L3 of `docs/spec/02-features.md`, the video templates table of
  `07-template-library.md`, and the AI video board row of `05-architecture.md`.

## Not verified

* **No video has been rendered or recorded by this workstream.** The recorder runs in a browser and the tests assert
  plans and commands, which is deliberate (a unit test must not render a 6 second video). What a recorded turn of the
  real 3D view looks like is unseen, as it was in decision 0058.
* **No panel is mounted.** `components/launch/Inspector.tsx` draws `PanelPlaceholder` for `board-ai-video`, and that
  file is L1's. One line mounts `components/video/AiVideoPanel` in its place; the PR says so.
* **The three new viewer events are unanswered.** Only `knitwright:turn` exists, so only the turntable can be recorded
  from today's 3D view. The panel says so; the one listener each needs is in two files this workstream does not own.
* **The fal board adapter has never been called.** Its request fields, the per-second price and the licence terms are
  from the public model page, as in decision 0058.
* **No database or browser test.** Nothing here adds a table, a route or a page, so there was nothing for an
  integration test to assert and nothing mounted for an end-to-end test to click. Both arrive with the wiring.
* **The frame sampling has not run in a real browser**, only against a fake video element.

## Alternatives

* **Bundle a static ffmpeg build in the function.** Rejected: it commits a third-party binary, carries a GPL or LGPL
  question nobody has answered, and would be sized against a function limit nobody has measured (decision 0002).
* **Record WebM only, and convert later.** Rejected: the spec asks for MP4 and a browser that can give MP4 should.
  Asking for MP4 first costs nothing, and a WebM says it is one.
* **Check the first frame only, as the still pictures do.** Rejected by the spec, and by the test that catches a clip
  which drifts half way through.
* **Sample frames on the server.** Rejected: it needs a decoder the deploy target has not got. The browser has one.
* **Hide a model with no commercial licence.** The spec says "commercial-licence models only", but no licence has been
  read yet, so hiding would offer nothing at all. The brief's rule is followed instead: the flag is data, and a model
  without one is labelled on its own button. Owner question 3.
* **Seed the twelve templates into the `templates` table now.** Rejected: it breaks the design library until
  `loadLibrary` is narrowed, and that file belongs to another workstream.
* **A per-second price in code.** Rejected by the plan's own rule, and because it is money.

## Consequences

* The deterministic videos work in any current browser, and will work unchanged on a server-side encoder: the plan is
  the input to both.
* Until the two 3D viewers answer the camera and colourway events, only the turntable can be recorded. That is visible
  on screen rather than hidden.
* A later target with ffmpeg needs an `FfmpegRunner` and a font file, and no change to the plan, the sequences or the
  templates.
* `CREDITS_ENFORCED` turning on changes no code here: the ledger stops being null.

## Dependencies

No new dependency. This workstream uses what the app already carries: React, Next.js, Tailwind, zod (server side only --
the panel imports no module holding a schema, which `tests/architecture/client-weight.test.ts` enforces), `sharp`
(through `lib/media-check`), and `typescript` in one test. Every one is already in the lock file under MIT or Apache-2.0.
**ffmpeg is not a dependency of this repository** and is not committed, bundled or redistributed; see decision 1 for its
licence.

## Owner questions

1. **What does a second of AI video cost, in credits, per model?** Every figure is the placeholder 1 credit a second,
   which is not a price. This is question 1 of the questionnaire, and it is money.
2. **Which models may be offered at all?** The four candidates the spec names are seeded as placeholders and none is
   called. Someone has to read their terms.
3. **Should a model whose commercial licence nobody has confirmed be offered and labelled, or hidden?** It is labelled
   today, which is what the brief asked for; the spec's own words are "commercial-licence models only".
4. **Is the studio turntable 8 seconds or 6?** Decision 0058 records 8 seconds for the media-set turntable; F-L3 and
   `07` both say 6 for the launch video. Both are in the code, each in its own place, and the spec is followed for the
   launch sequence. One of the two should probably change.
5. **Should sound ever be anything but the model's own?** No music is shipped and no music licence is held. A music
   library is a licence decision, not a feature decision.
6. **Should a deterministic video be kept in the design's media set, and if so under what kind?** Today it is handed to
   the person as a file; the media set's kinds are `studio_render`, `lifestyle`, `turntable` and `clip`, and a flip, a
   kit reveal and a carousel are none of them. Adding kinds is a migration and a shared contract.
7. **How many frames should the checker sample, and at what thresholds?** Five is a Knitwright default and the
   checker's own thresholds are still untuned (decision 0055).

## R-GAP-000

No rulebook entry covers the video studio, so every row, finding and field this workstream makes carries `R-GAP-000`.
The gaps are: what a deterministic video's length and shots should be; what aspects and resolution a clip is exported
at; how long an AI clip may be; what a second of AI video costs; whether a model may be offered without a confirmed
commercial licence; how many frames of a clip the checker measures and at what thresholds; and what a video template's
text slots and their limits should be.
