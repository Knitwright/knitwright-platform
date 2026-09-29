# 0007: Designs, versions and the editor

Status: Accepted
Date: 2026-09-29
Plan step: 6

## Context

Garments and measurements existed as libraries with no screen. This step adds the first
screen a user can work in, and the place designs are kept.

## Decision

1. **Two tables, `projects` and `spec_versions`.** A design is a project. Every accepted
   change is a new version. Versions are never changed or removed: a trigger refuses it
   for every role, as well as the grants. Restoring an old version stores a new one.
2. **Only the server writes designs.** The database cannot tell whether a garment spec
   is valid, so the server checks it with `lib/garment` first. The write functions can
   be run by the server only. Even the server cannot insert a version directly.
3. **Two saves from one version cannot both succeed.** The second is told the design
   was changed somewhere else. The editor sends its changes one after another, so quick
   clicking never causes this by itself.
4. **A change that changes nothing stores nothing.**
5. **The screen is built from the registry.** It names no option, choice, garment type
   or measurement. A new garment type needs no new screen.
6. **A choice that cannot be used is shown greyed out, with its reason.**
7. **Every measurement says where it came from, in plain words.** Suggested values use
   the attention colours. The green style is kept for values signed by a named person,
   which nothing is yet.
8. **A suggested option is shown as a suggestion**, with nothing selected, until the
   person chooses.
9. **A design that no longer fits the registry is repaired when it is opened.** Nothing
   is saved until the next change, which also reports what was dropped.
10. **Undo is a restore of the version before**, stored as a new version.

## Evidence

| Claim | Test |
|---|---|
| Sign in, create a crew tee, change two options and a measurement, reload, find them saved | `e2e/editor.spec.ts` |
| The isolation suite covers the two new tables | `tests/integration/isolation.test.ts` |
| Ten saves at once from one version: exactly one succeeds | `tests/integration/projects-db.test.ts` |
| A member of another brand can read and change nothing | `tests/integration/project-service.test.ts`, `e2e/editor.spec.ts` |
| A refused change stores nothing | `tests/integration/project-service.test.ts` |

## Not covered by a test that runs in CI

The trigger that refuses changes to `spec_versions` was checked by hand as the table
owner. No test connects as that role. The grants, which are tested, already refuse
every other role.

## Consequences

- Fabrics, colourways and artwork have no screen yet. They come with steps 7 and 8.
- Until size charts arrive (owner action A5), a new design has no sizes and no
  measurements. The brand types its size run and its own values.
- The history lists the last 100 versions.
- Renaming a design, or changing its style number or season, is not a version.
