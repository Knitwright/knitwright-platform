# 0057: Lifestyle images with scene replacement and virtual try-on

Status: Proposed
Date: 2026-10-27
Plan step: plans/platform-v4.md, workstream W3-B. Builds on 0054 (media sets), 0055 (generated-image checker), 0018 (photoreal images), 0012 (usage metering) and 0051 (credit gates).

## Context

Spec stage 4 asks for four lifestyle pictures of a design: on a pitch, in a changing room, on the street, and one on a person. The garment must stay exactly as designed: the crest, sponsors, names and numbers are never altered. Stage 1 gave us the media set and the checker; this step adds a `MediaGenerator` for them.

## Decision

1. **Flow** (`lib/media/lifestyle/generator.ts`). The front of the design is drawn as it is now (the same `renderReference` as the studio renders, and the same drawing on a transparent square, whose alpha is the garment mask the checker needs). A provider is asked for each scene with that picture. Every result goes through `checkGeneration` with the crest, sponsors, names and numbers of the drawing as protected regions (`protectedRegions` from 0054; a picture is `sponsor`, lettering is `number`, since the drawing cannot tell a crest from a sponsor). A picture that fails is asked for again once with another seed, then dropped. A dropped picture is never stored, never given a file and never reaches the set; only a picture the checker passed is returned to the set, with verdict `passed`.
2. **A set is never failed by this step.** `runMediaSet` fails the whole set (and removes the studio renders) when any generator answers `ok: false`. Lifestyle therefore answers `ok: false` only when the design cannot be drawn (when the studio generator has already failed), and otherwise returns whatever passed, which may be nothing. What was dropped, and why, goes to a report (`onReport`), written to the log as one line; the database has no row for a dropped picture. Owner question 3.
3. **Four scenes, fixed prompts** (`scenes.ts`). `pitch`, `changing_room`, `street`, `on_model`. A prompt is chosen by scene id from text in code, followed by one fixed paragraph telling the model to leave shape, colours, panels, crest, sponsor logos, names and numbers alone. No free text from a person reaches a model.
4. **Views.** An item is unique by (set, kind, view) and the contract has one `scene` view. The scenes use `scene`, `three_quarter`, `front` and `on_model`, always with kind `lifestyle`, which is what tells them from the studio renders. The names are wrong for the changing room and the street; the contract (W3-A's file) should get scene names. Owner/orchestrator question 4.
5. **Providers** (`provider.ts`, `adapters/`). `LifestyleProvider` makes some of the four scenes. A stub (`stub.ts`) lays the garment, slightly relit, on a gradient: deterministic, free, used by CI. It is not a try-on and draws no person. Adapters, each behind its own key, all with an injected `fetch`, none called by a test:

   | Adapter | Does | Key | Licence and terms |
   |---|---|---|---|
   | `photoroom` | scene replacement, Image Editing API v2 `edit` | `PHOTOROOM_API_KEY` | commercial service, Photoroom's terms; nothing copied |
   | `google-recontext` | scene replacement, Imagen product recontext on Vertex AI | `GOOGLE_VERTEX_ACCESS_TOKEN`, `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION` | commercial, Google Cloud terms; nothing copied |
   | `google-tryon` | virtual try-on, Vertex AI `virtual-try-on-001` | same | same |
   | `fashn` | virtual try-on, `tryon-v1.6` | `FASHN_API_KEY` | commercial service, FASHN's terms; nothing copied |
   | `fal` | all four scenes through the existing `lib/providers/fal.ts` client (nano-banana-2 edit) | `FAL_KEY` | fal's terms as already accepted in 0018; fal is asked to keep nothing |

   **IDM-VTON and CatVTON are not used**: the spec excludes them because their licences are non-commercial. There is no adapter, no weight and no code from either.
   Selection (`select.ts`) reads `LIFESTYLE_SCENE_PROVIDER` and `LIFESTYLE_TRYON_PROVIDER`. **Both unset is the default and means no lifestyle picture is made and nothing is spent**: the generator is not even registered (`register.ts`). A chosen provider with no key is left out and named in the log. The try-on provider is listed first; it is skipped when there is no picture of a person, and the scene provider then makes the model scene (as a prompt, not a try-on).
6. **Metering** (`budget.ts`). Before every paid call the cost is reserved with the usage meter (feature `photoreal`, route `media lifestyle:<provider>`), which applies the user, brand and global allowances of 0012. On top of that, a **daily cap per brand** (default $5, `LIFESTYLE_DAILY_CAP_MICRODOLLARS`) is read from today's unrefunded `usage_events` of that route, and the calls of one set are counted together so the four scenes cannot all take the last place. A provider that fails gives its reservation back; a picture that was made and then rejected does not (the money was spent). The cost of each picture, retries included, is stored on its item. Prices per adapter are Knitwright estimates, not the providers' price lists.
7. **Checker counter.** `LifestyleReport` has, per scene, how many attempts, whether the first passed, why a picture was dropped and which checks it failed, and totals `kept` and `passedFirstTry`. The spec's "at least 3 of 4 pass without a retry" is measured by that second number; it is logged for each set and is meaningless until real providers run.
8. **Label.** Every kept picture is a PNG with `Knitwright-AI-Generated=true` and a description in its own text chunks (`label.ts`; no date, no random value). The clean file carries it. See "Not verified": the watermarked preview does not.
9. **Retries and seeds.** A seed is a hash of project, version and scene, plus 7919 for the retry, so the same design asks the same question each time. Google adapters send no seed (a seed needs the provider's invisible SynthID mark off, and we keep it); fal sends none. A retry there is different because the call is.
10. **No new dependency, no migration, no committed media.** The model-picture port is `loadModelImage`; nothing loads one yet.

## Not verified

- **No adapter has been called against its real service.** There are no keys. Each is written from the provider's public documentation as read when written (endpoint, fields, answer shape) and tested against canned answers in `adapters/adapters.test.ts`; those answers are written from the documentation, not recorded from a call. A field name or an answer shape may be wrong.
- **The checker's thresholds are untuned (0055)**, so what it lets through from a real model is unknown, as is how many of 4 pass the first time. The stub passes by construction.
- **The label does not survive the watermark.** `watermark()` (W3-A's file) re-encodes with sharp, which drops text chunks; a test confirmed it. The clean file, which is what an unlocked set serves, is labelled; the watermarked preview carries the visible words "Knitwright preview" but no label in its metadata. A one-line change in `lib/media/watermark.ts` (put the chunks back) fixes it; I did not touch the file.
- The route change (`app/api/projects/[projectId]/media/route.ts`), `usage_events` read and the real metering path were not run: no Docker, so no e2e or db test ran here. CI is their first run.
- The stub's "on a model" picture has no person; the try-on adapters need a picture of a person that no code loads yet.

## Known gaps

- The provider selector in `components/media` (plan: "the provider selector") is not built: choice is by environment variable, which is all a platform has before W3-E's screen. 
- A dropped picture leaves no trace in the database, only a log line. W3-E, which shows "rejected ones explained in plain words and re-runnable", needs a row or a field for it, which means a change to W3-A's tables.
- The Google token is a short-lived access token. A service account with refresh is needed for real use.
- Generation runs the four scenes together within the set's 50 second limit (decision 0054); a slow provider with a retry can exceed it, and then the remaining pictures are dropped.
- Real providers return their own sizes. A square picture is scaled to 1024; any other shape is left to the checker, which rejects it.

## Owner questions

1. Which providers? One scene provider (Photoroom, Google recontext or fal) and one try-on provider (Google or FASHN) to start, with keys.
2. A licensed photograph of a person (or a few) for the try-on, kept where and used how? Without one the "on a model" picture is a prompt, not a try-on.
3. When a picture is dropped after its retry, should the club see that, or only get fewer pictures?
4. Scene names in the contract (`pitch`, `changing_room`, `street`) in place of reusing `scene`, `three_quarter` and `front`.
5. The daily cap per brand ($5 as built) and whether lifestyle spend should be charged to the same `marketing_media` credits or its own.
6. A sample of real generations from the chosen providers, to tune the checker.

## Alternatives

- Failing the set when lifestyle fails. Rejected: it throws away the studio renders, which are free and deterministic.
- A queue and a table for lifestyle jobs. Rejected for now: the set already runs as a job; a table is W3-A's.
- IDM-VTON or CatVTON. Excluded by the spec: non-commercial licences.
