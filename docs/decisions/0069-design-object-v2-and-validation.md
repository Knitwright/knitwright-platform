# 0069: Design object v2, validation on every save, and a rule behind every check

Status: Proposed
Date: 2026-10-29
Plan step: `plans/platform-v5.md`, wave 1, workstream X4 (spec F-0, F-G2)

## Context

Spec F-0 asks for one versioned design object that always sits on a base article, carries that article's structural
parameters, is validated on every save against a factory profile, and whose every finding carries a rulebook
reference. The spec's own JSON Schema (`docs/spec/schemas/design-object.schema.json`) describes that object in
snake_case.

What already existed: `lib/garment/spec-schema.ts` (the stored `GarmentSpec`, version 6), the validation gate and the
`design_statuses` table of decision 0039 (draft, validated, ordered), and the five editor guardrails of decision 0045,
exported but never registered. No design knew its base article, nothing validated on save, no finding named a rule,
and nothing stored what a check found.

## Decision

1. **The spec's design object is an export format, never the stored shape** (plan v5 owner decision 4). The platform
   keeps storing `GarmentSpec`. `lib/design-object/toDesignObjectV2(spec, context)` writes the spec's version 2.0
   object from it, and `lib/design-object/to-v2.test.ts` validates the result against
   `docs/spec/schemas/design-object.schema.json` itself, for all 21 committed design fixtures. Nothing reads the
   export back in, and no table holds it.

2. **`article` is added to the stored spec, and the schema version goes 6 to 7.** The smallest change to
   `spec-schema.ts`: one optional `articleRefSchema` (`baseArticleCode`, `productionClass`, `parameters`, at most 32
   of them, keys `^[a-z][a-z0-9_]{0,63}$`). The repo's own habit is to add an optional field without a bump
   (`namesAndNumbers`, `kitPattern`, `artworkStack` all did), so the bump is not needed to keep old designs
   readable; the plan asks for it, and it marks the design-object v2 line. **An old design migrates in code**:
   `lib/garment/repair.ts` gains `6: (input) => ({ ...input })`, a no-op upgrade, because a design saved before
   version 7 has no base article and nothing may be invented for it. `migrateSpec` then stamps version 7 and the
   design opens unchanged. Where the article is needed, `lib/validation` `articleOf` works it out from the garment
   type through the catalogue port; a design that maps to nothing gets a **warning**, never a blocker.

3. **The status set gains `approved`**: draft → validated → approved → ordered (spec F-0). `validated` still means
   only "no blockers against profile X on date D"; `approved` means a member of the brand accepted that version for
   ordering. A validated version may go back to draft, an approved one only on to ordered, an ordered one never
   moves. `lib/validation/status.ts` and migration `20261101030000_design_validation_v2.sql` (the trigger and
   `set_design_status`) both refuse everything else. Ordering straight from validated stays allowed, as decision
   0039 had it, until the owner says every order needs an acceptance first (owner question 1).

   `lib/production/contract/validation.ts` still holds the three-value `DESIGN_STATUSES` of decision 0039. That file
   belongs to no v5 workstream, so it was not edited: `lib/validation/status.ts` now owns the list as
   `VERSION_STATUSES`, and nothing imports the contract's copy any more. It should be removed by whoever next owns
   that file.

4. **`validation_results` stores what a check found**, per design version, factory profile and scope: the check's
   code, severity (`blocker`, `warning`, or none when it passed), message, target, `ruleId` and `passed`. Two scopes:
   `save` is written on every save, `full` when a person records a status. `full` includes the tech pack's "Ready for
   the factory" list; `save` does not, because that list needs the whole tech pack built. One row per version,
   profile and scope; a later run of the same scope replaces it, since a version never changes but a profile and the
   rulebook do. Members read their brand's rows; the only way in is `record_validation_result`, which only the
   server's own key may run.

5. **Validation runs on every save.** `lib/validation/on-save.ts` `validateOnSave` hooks into the one private
   `appendVersion` of `lib/projects/service.ts` and into `createProject`, so every path that stores a version is
   covered by two call sites. The save has already happened when it runs, so **a failure there never undoes the
   save**: it is logged at `warn` and the next save, or a status move, runs the checks again.

6. **Every finding carries a `ruleId`** (spec decision 11). `lib/validation/rules.ts` maps every code a check can
   produce to a rule of `docs/spec/articles/JSY-SS-01/rulebook.md`, or to `R-GAP-000` when no entry fits yet. No
   rule's text is written here, and no code is given a neighbour's rule. `rules.test.ts` reads the rulebook file,
   checks that all 45 rules are there, that every id used is one of them or the gap id, and that every readiness line
   the real tech pack produces is covered. The codes still on `R-GAP-000` are listed in the PR comment and in
   "Gaps in the rulebook" below; X2 (`rulebook_gaps`) is where they will be collected once it merges.

7. **The guardrails are registered, and two modules are new.** `lib/validation/checks/guardrails.ts` registers the
   five checks of decision 0045 (`seam-crossing`, `dpi`, `bleed`, `safe-zone`, `gamut`) as `CheckModule`s, each with
   its rule. `parameters-in-range` checks every chosen parameter against the base article's approved definition
   (unknown, wrong kind, outside the range, off the step, not an offered choice), and a finding carries the rule of
   its own range when the catalogue gives one. `moderation-clear` turns a `pending` result into a warning and
   `flagged` or `blocked` into a blocker (F-G2 "moderation status clear").

8. **Two ports, not two dependencies** (plan v5 Lessons 9). `lib/validation/ports.ts` holds the smallest interfaces
   X4 needs from the base article catalogue (X1: `articleForType`, `parameterDefs`) and from moderation (X8:
   `statusesFor`). Both ship with an unwired implementation that says "nothing known", which raises no finding about
   parameters and none about moderation. Nothing imports from either workstream's directory. The orchestrator wires
   the real ones before wave 2.

9. **A new dependency: `ajv` 8.17.1 (MIT), devDependency only.** It validates the export against the spec's JSON
   Schema in tests. No runtime code imports it.

## Mapping to the spec's names

| Spec (`03-data-model.md`) | Platform |
|---|---|
| `design` | `projects` |
| `design_version.doc` | `spec_versions.spec` (a `GarmentSpec`, not the spec's design object) |
| `design_version.status` | `design_statuses.status` |
| `validation_result` | `validation_results` (plus `scope`, which the spec does not have) |
| `design.base_article_id` | `GarmentSpec.article.baseArticleCode`, a catalogue code rather than a key |

## Evidence

| Claim | Test |
|---|---|
| The export validates against the spec's own schema, on every committed design fixture | `lib/design-object/to-v2.test.ts` |
| Every code a check can produce resolves to a rule, and every id is one the rulebook holds | `lib/validation/rules.test.ts` |
| Every readiness line the real tech pack produces has a rule | `lib/validation/rules.test.ts` |
| Validation runs on save, stores the checks, and a failure never undoes the save | `lib/validation/on-save.test.ts` |
| Illegal status moves are refused, in the app and in the database | `lib/validation/status.test.ts`, `tests/integration/design-validation-v2.test.ts` |
| A version 6 design opens as version 7 with no base article invented | `lib/garment/repair.test.ts` |
| Parameters outside an approved range block, and a design on no article only warns | `lib/validation/checks/parameters.test.ts` |
| Only the server writes a result; no brand sees another's | `tests/integration/design-validation-v2.test.ts`, `tests/integration/isolation.test.ts` |

## Gaps in the rulebook (`R-GAP-000`)

No entry in `docs/spec/articles/JSY-SS-01/rulebook.md` fits these yet, so each uses `R-GAP-000`:

- the factory profile and the gate itself: `article-not-made`, `moq-not-set`, `lead-time-not-set`, `check-failed`;
- the base article: `article-not-set`, `article-not-offered`;
- parameters, when the catalogue gives the range no rule of its own: `parameter-unknown`, `parameter-wrong-type`,
  `parameter-out-of-range`, `parameter-off-step`, `parameter-not-offered`;
- moderation: `moderation-pending`, `moderation-flagged`, `moderation-blocked`;
- readiness lines: `components-filled`, `components-no-proposals`, `fabric-use-basis`, `pattern-grain`,
  `pattern-present`, `pattern-review`, `print-avoid-colours`, `print-colour-codes`, `print-files`,
  `print-picture-read`, `release-frozen`.

The parameter rules the worked article does have (`R-PAT-003`, `R-PAT-004`, `R-PAT-005`) are carried per parameter
by the catalogue, so a real range answers to its own rule even while the generic code is a gap.

## Not done

- **No "Accept for ordering" button.** The route takes `approved`, and the order flow can use it, but
  `components/production/validation/ValidationPanel.tsx` belongs to no v5 workstream and still knows three statuses.
  Whoever owns that panel adds the button and the e2e step.
- **Nothing reads `validation_results` on a screen.** `readValidationResults` exists for the surfaces that will want
  the stored checks without recomputing them (spec F-0: "every surface renders the same version identically").
- **The guardrails run on almost nothing on the server.** As decision 0045 said, nothing yet turns a design's artwork
  stack into placed boxes on pattern panels, so only the colour estimate has input on the save path; the editor runs
  the rest live. The modules are registered and tested, and will see real input when the piece mapper lands.
- **Panels in the export are the design's views** (front, back, sleeves), not the spec's garment panels
  (`front_left`), because that is what the stored stack holds. The pattern panel map comes with X3.
- **Every exported asset is `kind: "artwork"`**, and the fabric's catalogue code falls back to the design's own
  fabric id. Both come from X1's catalogue when it is wired, through `ExportContext`; neither is guessed.
- **The export refuses rather than cut a design down**: no base article, no screen colour, more than 8 colours, or
  printed text over 60 characters. The stored shape allows 48 colours and 80 characters, so a design can be legal
  and still not be exportable (owner question 4).
- Database and e2e tests were written but not run locally (no Docker in this sandbox). CI is their first run.

## Owner questions

1. Must every order be accepted for ordering first, or may a validated version be ordered straight away (today it
   may, as decision 0039 had it)?
2. Who in a brand may accept a version for ordering: any member, or only an owner or admin? Today any member may,
   like recording "validated".
3. Should a version that was validated or accepted go back to draft when the factory profile it was judged against
   changes? Today it does not. (Carried over from decision 0039.)
4. The spec's export format holds 8 colours and 60 characters of printed text; the editor allows 48 and 80. Should
   the editor be brought down to the export's limits, or the export format raised?
5. Is a picture still waiting for the content review a warning (today) or a blocker before an order?
6. The rulebook gaps listed above: each needs an entry, or a decision that the check should not exist.

---

# 0069 revision 1: the two ports are wired (wave 2 prerequisite)

Status: Proposed. Date: 2026-10-30. Plan step: `plans/platform-v5.md`, the opening paragraph of "# Wave 2" (the
orchestrator wires the wave 1 interfaces in one small PR). No migration.

Point 8 above left `ArticleCatalogue` and `ModerationReader` unwired. They are wired now, in
`apps/web/lib/validation/live-ports.ts`:

- **X1 into X4.** `catalogueFrom(client)` answers `articleForType` from `lib/catalogue`'s `baseArticleForType`
  (decision 0066's registry map) plus `getBaseArticle` for the article's production class, and `parameterDefs`
  from that same article's `parameter_defs` rows. The whole article is read once per port and kept, because a
  save asks about one article twice. A garment type the map does not cover still gives null, so a design on
  socks or a cap keeps the `article-not-set` warning rather than gaining a blocker.
- **The two `ParameterDef` shapes are mapped explicitly, never cast.** The catalogue keeps one row with
  nullable `min`, `max` and `enumValues`; validation takes a union on `type`. `toValidationParameter` maps
  range, enum and bool, and answers null for a row that cannot be expressed — a range with no minimum or
  maximum, an enum with no values. `parameter_defs` itself refuses both (migration 20261101010000), so null
  means a row the database could not have stored; it is dropped rather than given a range nobody approved.
- **X8 into X4.** `moderationReader(store)` reads decision 0073's own `ModerationStore.latest`, the existing
  "latest check of each target", for the asset and text targets a design uses. A reviewer's decision wins over
  the automatic result: allowed reads as `clear`, blocked as `blocked`. A target with no kept screening is left
  out of the answer, as the interface says, so an unscreened picture still raises nothing at save time; it is
  `screenBeforeOrder` that holds the order for a person. The brand is not part of the lookup, because
  `moderation_checks` is read with the server's own key and `latest` is keyed by the target's own id.
- **Where they are passed.** Both call sites of `validateOnSave` in `lib/projects/service.ts` (`createProject`
  and the private `appendVersion`) now pass `livePorts(admin)`.

`UNWIRED_CATALOGUE`, `UNWIRED_MODERATION` and `UNWIRED_PORTS` stay exported and tested: they are what the unit
tests of both sides and the plan's test doubles use.

**Not wired.** `readinessFor` in `lib/validation/design-input.ts` — the `full` scope, read when a status is
recorded — still defaults to `UNWIRED_PORTS`. Its two callers are `app/api/projects/[projectId]/validation/`
and `lib/clubs/reorder/use-cases.ts`, neither of which this PR owns, and a member's own client cannot read
`moderation_checks` at all (platform admins only), so wiring that path needs a decision about which client it
reads the screenings with. Raised on the PR.

## Evidence

| Claim | Test |
|---|---|
| Both shapes of parameter are mapped, and a row the database could not hold is dropped, not invented | `lib/validation/live-ports.test.ts` |
| One article is read once however often a save asks about it | `lib/validation/live-ports.test.ts` |
| A reviewer's decision wins over the automatic result, and an unscreened target is left out | `lib/validation/live-ports.test.ts` |
| The ports read the real catalogue and the real screenings with the server's own key | `tests/integration/wave2-wiring.test.ts` |
