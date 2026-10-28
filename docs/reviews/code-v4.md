# Code review of waves 1 to 4 (v4 W5-B)

Scope: platform code in `apps/web` (`app`, `lib`, `components`). Not reviewed: Store/Sell code, `Sportswear/`, `kitwright/`, `supabase/config.toml`, migrations.
Method: a TypeScript AST scan for function length and nesting, an export-usage scan across the whole app (names matched by word, so a type or constant shared with another file reads as used), and grep passes for console output, empty catch blocks, duplicated helpers, hardcoded addresses and keys, and the forbidden words of `lib/techpack/wording.test.ts`.
Baseline on main (`a30520a`): typecheck, lint and `tests/architecture` plus the wording test all pass.

## Summary

| Check | Result |
|---|---|
| Files over 800 lines | none (largest source file is 389 lines) |
| Files over 400 lines (plan rule) | none |
| `console.log` / `console.debug` in app code | none |
| Hardcoded secrets | none (provider endpoints are named constants beside their adapters) |
| Settled-sounding words in user text outside the techpack wording scan | none found |
| Functions over 50 lines | 103 (73 are React components or page functions, mostly JSX; 30 in `lib`) |
| Nesting over 4 levels | 2 |
| Unused exports | 51 with no reader at all; many more used only by tests |
| Swallowed errors | 40 sites, all best-effort cleanup or a parse fallback; none found that hides a failure from the user |

**HIGH findings: none. No code was changed by this PR**, because the brief is to fix HIGH items only. All findings below are open.

## MEDIUM

| # | File | Finding | Status |
|---|---|---|---|
| M1 | `components/artwork/ArtworkPanel.tsx`, `components/artwork/generators/GeneratorGallery.tsx`, `components/design-import/DesignImportPanel.tsx` (126 lines, changed 2026-10-25), `components/gltf/ModelViewer.tsx` | Whole components that nothing imports. `ModelViewer` is a known owner question (`lib/gltf/OWNER-QUESTIONS.md`, editor still uses `Preview3D`). The other three are unwired UI for shipped lib features. Deleting them removes the only UI for those features, so the owner should decide wire or delete. | open |
| M2 | `lib/media/lifestyle/generator.ts:133` | `catch {}` drops the cause of a failed picture check and records only `check_failed`; the provider branch above it refunds and keeps the reason. Log the error as `lib/media/generate.ts` does. | open |
| M3 | `lib/design-import/match/grid.ts:164` `regionCount`, `lib/design-import/outline.ts:96` `largestRegion` | Nesting of 5 levels (flood fill loops). Extract the neighbour step. | open |
| M4 | `lib/sizing/csv.ts:34` `parseCsv` (61 lines, nesting 4) | Hand-written state machine; split into field and row readers. | open |
| M5 | `lib/credits/service.ts:88` `createCreditsService` (84 lines) | One factory holding every operation; split by operation. | open |
| M6 | `lib/media/lifestyle/generator.ts:91` `makeScene` (65), `lib/print/layout/build-scene.ts:91` `buildPieceScene` (69), `lib/projects/notes.ts:55` `describeAction` (67), `lib/garment/apply-action.ts:121` `run` (64), `lib/print/build/file-builder.ts:69` (63), `lib/design-import/marks.ts:127` `readMarks` (63), `lib/artwork-intake/vector/path.ts:92` (61), `lib/sizing/resolve.ts:58` (58), `lib/techpack/build.ts:47` (57), `lib/pattern-library/dxf/read.ts:125` (56), `lib/design-import/pipeline.ts:153` (56), `lib/techpack/exports/tables-parts.ts:26` (54), `lib/design-import/landmarks.ts:107` (54), `lib/artwork-intake/store.ts:94` (54), `lib/garment/reconcile.ts:82` (53), `lib/techpack/exports/tables-front.ts:25` (51), `lib/media/service.ts:76` (51), `lib/flat/families/bottoms/shape.ts:64` (51) | Non-fixture `lib` functions over 50 lines. | open |
| M7 | `signedArea` in `lib/flat/kit-pattern.ts`, `lib/guardrails/geometry.ts`, `lib/garment3d/triangulate.ts`, `lib/pattern-library/geometry.ts`, `lib/print/geometry/polygon.ts`; `polygonArea` in `lib/design-import/outline.ts`, `lib/techpack/production/geometry.ts`, `lib/garment3d/triangulate.ts` | Duplicated polygon-area helpers with differing point types. Consolidate into `lib/print/geometry/polygon.ts` after checking each sign convention. | open |

## LOW

| # | File | Finding | Status |
|---|---|---|---|
| L1 | `lib/ops/packing/schemas.ts:3`, `lib/ops/schemas.ts:4`, `lib/leads/admin.ts:144`, `lib/leads/organisation.ts:38` | Four copies of `emptyToNull`. Share one in `lib/server`. | open |
| L2 | `lib/patterns/client.ts`, `lib/images/client.ts`, `lib/providers/*.ts`, `lib/projects/chat.ts`, `lib/projects/artwork-upload.ts`, `lib/media/lifestyle/adapters/*.ts` and others | The `response.json().catch(() => null)` then `safeParse` pattern is repeated about 18 times. Add a `readJson(response)` helper. | open |
| L3 | `lib/media/video/clip.ts:76-77`, `lib/media/video/turntable.ts:52-53`, `lib/design-import/service.ts:189,242`, `lib/design-import/derived.ts:31`, `lib/artwork-intake/store.ts:64,75` | `.catch(() => undefined)` on cleanup deletes. Intentional best-effort, but orphaned files are not logged; log at warn level. | open |
| L4 | Unused exports with no reader (51 in total), for example `lib/credits-gate/server.ts` `orderDesignVersion`, `lib/credits/kinds.ts` `isOutputKind`, `lib/guardrails/geometry.ts` `boxCentre`, `lib/print/geometry/polygon.ts` `roundRing`, `lib/settings/registry.ts` `priceSettingKey`, `lib/flat/families/outerwear/parts.ts` `collarTop`, `lib/media/lifestyle/select.ts` `SCENE_PROVIDERS` and `TRYON_PROVIDERS`, `lib/templates/catalogue.ts` `TEMPLATE_SOURCES`, `lib/usage/cost.ts` `USAGE_FEATURES`, `lib/techpack/exports/contents.ts` `SVG_VIEWS`, `lib/media/video/limits.ts` `MAX_TURNTABLE_SECONDS`; plus unused schema input types in `lib/clubs/schemas.ts`, `lib/design-import/schemas.ts`, `lib/brand-runs/schemas.ts`, `lib/comments/schemas.ts`. Full list: run the scan in this report's method. Delete once the owning workstream confirms nothing is planned. | open |
| L5 | Exports used only by tests (hundreds, mostly types and fixtures) | Not dead code; noted so a later `knip` run is expected to be noisy. | open |
| L6 | 73 React components or page functions over 50 lines, the longest `ArtworkCard` (139), `RunBuilder` (131), `ArtworkAndColourView` (129), `ChatPanel` (129), `DiffPanel` (111), `CommentsPanel` (111) | Long JSX bodies, nesting 0 or 1. Split into sections when next touched. | open |
| L7 | `lib/artwork-intake/fixtures/fake-admin.ts`, `lib/fabrics/fixtures/fake-db.ts`, `lib/media/test-deps.ts`, `lib/techpack/fixtures/designs.ts` | Long fixture builders in non-test paths. Acceptable as fixtures. | open |
| L8 | `lib/techpack/wording.test.ts` | The wording scan covers only techpack, project tech-pack and garment registry sources. A grep of the wave 3 and 4 directories (`media`, `comments`, `designers`, `brand-runs`, `pattern-service`, `credits`, `clubs`, `templates`, `validation`, `components`, `app`) found no violation, but nothing enforces it there. Extending the test is a W5-C or owner decision. | open |

## Not changed

No file was moved, no test touched, no migration touched. `vitest.config.mts` and `isolation.test.ts` are unchanged.

## Fixed in the follow-up

Branches `fix/code-review-v4` and then `fix/code-review-v4-rest` (M6, L4, L6, L8 finished). Behaviour-preserving; no migration, no `Sportswear/`, `kitwright/` or `supabase/config.toml` touched, and `vitest.config.mts` and `isolation.test.ts` unchanged. The second branch keeps out of the files `fix/security-app-v4` changes, except one non-adjacent line removed in `lib/media/video/limits.ts`; the two merge without conflict.

| # | Result | Notes |
|---|---|---|
| M1 | needs owner | Wire or delete `ArtworkPanel`, `GeneratorGallery`, `DesignImportPanel`, `ModelViewer`. Not changed. |
| M2 | fixed | The lifestyle generator logs the failed picture check as `lib/media/generate.ts` does. `LifestyleDeps` gained an optional `log`; `register.ts` passes it in. |
| M3 | fixed | Neighbour step extracted in `regionCount` and `largestRegion`. |
| M4 | fixed | `parseCsv` split into field and row readers; messages and line numbers unchanged. |
| M5 | fixed | `createCreditsService` built from one factory per operation; same public API. |
| M6 | fixed | Split in `fix/code-review-v4`: `makeScene`, `buildPieceScene`, `describeAction`, `run` (apply-action), file-builder, `readMarks`, `path.ts`, `sizing/resolve`, `techpack/build`. Split in `fix/code-review-v4-rest`: `pattern-library/dxf/read.ts` `pieceFromBlock`, `design-import/pipeline.ts` `runImport`, `techpack/exports/tables-parts.ts` `componentsSection`, `design-import/landmarks.ts` `findBodyLandmarks`, `artwork-intake/store.ts` `storeArtwork`, `garment/reconcile.ts` `reconcile`, `techpack/exports/tables-front.ts` `coverSection`, `media/service.ts` `mediaStore`, `flat/families/bottoms/shape.ts` `bottomsBasisOf`; warnings, messages and their order are unchanged. No non-fixture `lib` function is over 50 lines except `artwork-intake/vector/path.ts` `arcToCubics` (52, not in the finding). The exhaustiveness check is back: `lib/garment/action-groups.ts` splits the action union into three typed groups with type guards, `describeAction` and `run` dispatch through them, and the fallback takes a `never`, so an action type added to the union but not to a group fails the build. |
| M7 | fixed | One implementation in `lib/print/geometry/polygon.ts`; thin adapters keep each module's names, point types and sign convention (the design-import and techpack `polygonArea` stay absolute). `polygon-adapters.test.ts` proves results equal the old implementations. The index-based triangle `signedArea` in `garment3d/triangulate.ts` is not a polygon helper and was left. |
| L1 | fixed | `lib/server/empty-to-null.ts`; the four copies were identical. |
| L2 | fixed | `readJson` in `lib/http/read-json.ts` (not `lib/server`, because browser code uses it); all 24 `json().catch` sites use it; null on bad JSON as before. |
| L3 | fixed | Cleanup-delete failures are logged at warn level and still swallowed. |
| L4 | fixed, some kept | `fix/code-review-v4` deleted the exports with no reader at all. `fix/code-review-v4-rest` deleted `roundRing`, `SCENE_PROVIDERS`, `TRYON_PROVIDERS` and `MAX_TURNTABLE_SECONDS` (no reader found by grep), then ran `npx knip@5 --include exports,types` until it settled: about 1,000 exports were made module-private, deleted when nothing in their own file used them either (31 declarations, plus a fixture constant and imports only they used), or dropped from a barrel `index.ts` that nobody imported them through; tsc decided each one, and any name still imported was put back. The full list is in the PR. Kept on purpose: `orderDesignVersion` (documented future hook); names the sizing public-surface test lists; the media copy deck, which `copy.test.ts` reads whole; exports named in docs (decisions, runbooks, owner questions); exports in files the security branch `fix/security-app-v4` changes, and names it starts to use. knip still reports about 85 after this, all in those groups or sharing a name with another symbol. |
| L5 | not changed | Per brief. |
| L6 | fixed for the named components | `fix/code-review-v4` split `ArtworkCard`, `RunBuilder` and `ArtworkAndColourView`. `fix/code-review-v4-rest` split `ChatPanel` (message list, chat form, view; the server calls and version tracking moved to helpers and small hooks), `DiffPanel` (form, before-and-after card; preview and confirm calls as helpers), `CommentsPanel` (list and action hooks, mentions line, status filters), and finished `RunBuilder` (order state hook, size-label hook, run choices, flags notice) and `ArtworkCard` (load and action hooks, heading); markup, text and requests are unchanged and each named component is now 50 lines or fewer. The other long components and pages the scan counted are left, as the finding says, to be split when next touched. |
| L7 | not changed | Per brief. |
| L8 | fixed, 2 items need owner | Done in `fix/code-review-v4` (commit e34b6b3): `lib/techpack/wording.test.ts` now also scans prose in `lib/{media,comments,designers,brand-runs,pattern-service,credits,clubs,templates,validation}`, `components` and `app`, so every directory the finding names is covered; checked again in `fix/code-review-v4-rest`, nothing to add. Four hits are allow-listed, none edited: two are negated ("could not be checked"), the other two need an owner decision: `lib/media/video/clip.ts` ("a lifestyle picture that passed the check") and `lib/media/lifestyle/register.ts` (a log line, "passed the first time"). |
