# 0059: The Studio media screen

Status: Proposed
Date: 2026-10-27
Plan step: plans/platform-v4.md, workstream W3-E (spec stage 4). Builds on 0054 (media sets), 0055 (checker), 0057 (lifestyle), 0058 (turntable and clip), 0051 (credit gates), 0012 (metering).

## Context

Stages 1 and 2 of wave 3 built the media routes and the generators. A member still had no screen to use them: no way to start a set, watch it fill, use credits, record a turntable or make a clip without calling the API by hand.

## Decision

1. **One tool, "Media", on the workspace rail** (after "Ideas", before "History"). One entry in `lib/workspace/tools.ts` (`RAIL_TOOLS`, `TOOLS.media`, section `media`), one icon path, one `case` in `PanelSections.tsx`. It is on the rail, not in the header, so no header file changes. Adding a rail tool changes two existing tests that list the rail: `lib/workspace/tools.test.ts` and the tab list in `e2e/editor.spec.ts`.
2. **UI only.** Everything is in `components/media/screen/`. No `lib/media` file, route or migration changed. Logic is plain TypeScript with unit tests (`model.ts` tiles and the clip rule, `state.ts` one reducer, `api.ts` the calls with every answer parsed, `turntable.ts` the recording steps, `share.ts`, `timing.ts`); the `.tsx` files hold markup and wiring.
3. **Nothing is fetched until the tool is opened.** The workspace draws every panel at once and hides the others, so the screen waits (IntersectionObserver) before it reads the newest set. It never starts a set by itself.
4. **Progress per item.** The three studio views are waiting tiles that fill as each picture arrives (the screen reads the set every 1.5 s, up to 60 times, then says it stopped and offers to ask again). Lifestyle tiles (four scenes) appear once the set holds at least one lifestyle picture.
5. **Watermark state is the server's.** A tile shows what `GET .../items/<id>` serves; the badge says "Preview" until the set is unlocked. The screen never builds a clean address: after the spend it reads the set again and the same address now serves the clean file. A test and the e2e check that no path to a clean file reaches the page.
6. **Credits.** "Use credits" posts to the existing unlock route (the gate, 0051, decides and refuses in words, for example a short balance). The price chip reads `GET /api/credits`; with `CREDITS_ENFORCED` off it says "Not charged yet". A failed credits read hides the chip and nothing else.
7. **Verdict in words.** "Matches your design", "Did not match your design", "Being compared with your design", "Not compared with your design", "Drawn from your design". The words the wording rule reserves (checked, passed, approved, confirmed and the rest) are not used; `copy.test.ts` scans every sentence.
8. **Turntable.** The screen's "Record turntable" uses the recorder and sentences of 0058 (`components/media/video/record.ts`, `lib/media/video/copy.ts`; imported, not edited) against the set it already has, then reads the set so the new tile shows. The 3D view is off by default, so without it the person is told to open the 3D view first.
9. **Clip.** The button works when the server's rule would allow it: a finished set with a lifestyle picture that matches the design, on the pitch or on a model, and no clip for it yet. Otherwise the reason is printed under the button. The server stays the authority.
10. **Share and download.** An unlocked picture has a download (named after its label). "Share" appears only where the browser can share a file; it shares the file, never a link, because the picture addresses are for members only. The turntable video is free, so it can be downloaded at once.
11. **Look.** Dark glass tiles in a two or three column grid inside the panel, per `plans/design-reference.md`. Every button is a real button, the tile list is a list, pictures have text alternatives, progress is a polite live region, a refusal is an alert.

## The timing harness

`components/media/screen/timing.ts` records how long each step of a full run takes (set made, credits used, turntable) and writes a report. `e2e/media-screen.spec.ts` runs it against the stubs, prints it and attaches `media-run-timing.json` to the test.

**The spec target, "4 images and 1 clip in under 3 minutes", is unmeasured.** Stubs answer at once, so a stub run says nothing about real providers. The harness never compares a run with 180 seconds and the report prints the status "unmeasured" (tested). In this repository's e2e no lifestyle provider is switched on, so no lifestyle picture exists and the clip step cannot run; the report lists it as not run. To measure: set `LIFESTYLE_SCENE_PROVIDER`, `LIFESTYLE_TRYON_PROVIDER`, the provider keys and `MEDIA_VIDEO_LIVE`, run the same flow by hand against a real design with the stopwatch, and record the numbers here.

## Evidence

Unit tests for every module of the screen (tiles, progress, clip rule, reducer, API parsing, turntable steps, share, timing, wording). One end-to-end spec drives the real screen, API and stub generators. See the pull request for what ran where.

## Alternatives

- A header chip like "Photo": would have needed an edit to the header, which this step does not own.
- Reusing `TurntableControl` unchanged: it does not know the set, so the new turntable could not appear without a page reload.
- A "share link" to a picture: the addresses need a member's session, so a link would be useless to the people the picture is for.

## Consequences

A member can do the whole of stage 4 in one panel. Four things the screen cannot do well because of the server side, listed so the owner or the orchestrator can decide (none was changed here):

1. **A dropped lifestyle picture is invisible to the API.** A rejected picture is never stored and its findings go only to the log (0057), so the screen cannot say which check failed. It can only say, in general words, that a scene is missing and why a scene is dropped. The wording for each finding code is not built because no route returns the codes.
2. **"Try again" cannot regenerate a version.** `POST .../media` returns the existing set for a version (and starts again only after a failed set). So "Try again" works for a failed set and otherwise answers "This version of the design already has its media. Save a new version to make new pictures." Re-running dropped scenes needs a server route (an owner decision: does a re-run cost another provider call and another daily-cap place?).
3. **Lifestyle off looks like "none made".** The screen cannot tell "no provider switched on" from "every picture dropped" when a set has no lifestyle picture; it shows the note that lifestyle pictures need a picture service switched on.
4. **A clip charges the set's credits without unlocking the set.** The clip route runs the gate for `marketing_media` (once for each version, 0058 item 6) but does not unlock the set. With credits enforced, pressing "Make 5-second clip" on a locked set spends the credits and leaves the pictures watermarked until "Use credits" is pressed, which then charges nothing more. The screen words the clip note as "charged with the set, once for each saved version". If this is not wanted, the clip route should unlock, or the button should wait for the unlock.

## Not verified

- The end-to-end spec and `pnpm build` could not be run with a database in the cloud sandbox where this was written; CI is the first run of the e2e spec. The unit tests, typecheck and lint ran.
- Never seen in a browser: no one has looked at the screen with real data. Layout at phone width, the look of the dark glass tiles and the keyboard order are written from the design reference, not inspected.
- The turntable button is exercised against a canvas the test draws, not the real 3D view (off by default), the same as in 0058.
- Nothing was run against a real provider, so there is no real timing and no real pass rate.

## Owner questions

1. Should a clip need the set to be unlocked first (consequence 4)?
2. Should "Try again" on a dropped lifestyle picture be allowed for the same version, and at what cost (consequence 2)?
3. Should the Media tool also get a chip in the header next to "Photo" and "Make it"?
4. Should the checker's findings be stored with a dropped picture so the screen can say which check failed?
