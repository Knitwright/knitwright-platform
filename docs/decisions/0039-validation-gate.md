# 0039: The validation gate and design status

Status: Proposed
Date: 2026-10-24
Plan step: `plans/platform-v4.md`, workstream V1

## Context

The product spec says a design is orderable only when it has no blockers against the factory that
will make it, and that a design object has a status: draft, validated, ordered. Until now the only
gate was the tech pack's "Ready for the factory" list, computed for the screen and nowhere stored.

## Decision

1. **One function, `validateDesign(design, profile, registry)`** in `apps/web/lib/validation/`.
   It returns findings `{code, severity: blocker|warning, article, panel, message, fix: {action, whoActs}}`
   (the schema is in `lib/production/contract/validation.ts`). It runs before any order and any file generation.
2. **It composes what exists.** Every open line of the tech pack readiness list becomes a finding
   `readiness-<id>`. Lines in the groups proof, order and release are warnings (they happen after validation);
   every other open line is a blocker. Profile checks add `article-not-made` (blocker) and `moq-not-set`,
   `lead-time-not-set`, `price-ladder-not-set` (warnings).
3. **Pluggable checks.** A `CheckModule {id, run}` and an immutable registry. V7 registers dpi, seam, gamut and
   safe-zone modules after this merges. A module that throws becomes a `check-failed` blocker.
4. **Factory profile model.** `factory_profiles` (platform data; signed-in members read, the server writes) holds a
   typed profile: articles with a MOQ each, fabrics with swatch ref and colour delta, structural options, price ladder,
   lead time, file formats, HS codes. A missing value is `{status: "not-set"}`, never a guess. The one seeded profile
   is labelled "Knitwright default profile, not agreed with a factory". Its articles come from the garment registry at
   read time (so a new garment needs no migration); the stored row only carries the label.
5. **Design status.** `design_statuses`, one row per design version, no row meaning draft. Moves: draft to validated,
   validated to draft (the design changed), validated to ordered. A draft cannot be ordered; an ordered version never
   moves. The app (`lib/validation/status.ts`) and the database (a trigger and `set_design_status`) both refuse the rest.
   "validated" means only: no blockers against profile X on date D. The row stores the profile id and a SHA-256 of the
   sorted findings. User text says "No blockers against profile X on D", never "verified" or "approved".
6. **Ordering is not exposed by the route.** The route moves a version to validated or back to draft. Moving to
   ordered is for the order flow (V5 / the Store) through `writeDesignStatus`, which also needs `refundForOrder` from V6.
7. **No foreign keys into other workstreams' tables.** `design_statuses` refers to `projects` and `spec_versions`, which
   already exist; the profile is referred to by id text.
8. **No new dependency.**

## Not verified

The migration and its database tests were written but not run in the cloud sandbox that built this (no Docker). The
end-to-end test was likewise not run. CI is the first run of both.

## Owner questions

- Minimum order quantity per article, for the real factory.
- Price ladder (quantity breaks and unit prices).
- Lead time in days, and whether it differs by article.
- Swatch fabrics the factory prints and the colour difference it accepts for each.
- Which open readiness lines should block an order, and which should only warn (today: proof, order and release only warn).
- Whether a version validated against a profile should go back to draft when that profile changes.
