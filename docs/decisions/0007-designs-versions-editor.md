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
10. **Undo goes back step by step.** A version that restored another holds the same
    design as the one it restored, so Undo goes to the version before that original.
    With versions 1, 2, 3: Undo stores 4 as a copy of 2, Undo again stores 5 as a copy
    of 1, and a third Undo is not offered. The server works the target out.
11. **The server decides where a value came from.** What a browser sends carries no
    source. The server marks it as typed by the user. Only writers on the server, such
    as a chart or the assistant, can give another source.
12. **The logic of the editor lives in pure functions** under `lib/projects`: the queue
    of changes, what a control shows while a change is on its way, what is written in a
    field, and when focus moves. The components hold markup and wiring.

## Evidence

| Claim | Test |
|---|---|
| Sign in, create a crew tee, change two options and a measurement, reload, find them saved | `e2e/editor.spec.ts` |
| The isolation suite covers the two new tables | `tests/integration/isolation.test.ts` |
| Ten saves at once from one version: exactly one succeeds | `tests/integration/projects-db.test.ts` |
| A member of another brand can read and change nothing | `tests/integration/project-service.test.ts`, `e2e/editor.spec.ts` |
| A refused change stores nothing | `tests/integration/project-service.test.ts` |

## Reviews, 2026-09-29

A security reviewer attacked the local database and app as two users in two brands and
found no way across brands, and nothing critical or high. A code reviewer broke the pure
modules 106 ways, all caught, and found the real defects in the components, which had
no unit tests.

| Finding | Done |
|---|---|
| A browser could claim any source for a value | Fixed. See decision 11. |
| Undo only moved between two states | Fixed. See decision 10. |
| A choice that was not saved could look saved after a conflict | Fixed |
| The queue kept sending after a conflict, and lost track after a lost reply | Fixed |
| A success in one field cleared the error on another | Fixed |
| A typed value could not be cleared, and typed text could be lost | Fixed |
| Arrow keys saved on every step | Fixed |
| A choice that cannot be used could not be reached by keyboard | Fixed |
| The new design page named the tops family in code | Fixed |
| Version numbers and ids had no bounds | Fixed |
| No size limit on a stored spec | Fixed. 256 KB. |
| The append-only rule had no automated test | Fixed. A test connects as the table owner. |

## Known gaps in the tests

- The test that connects as the table owner was not checked to fail with the trigger
  removed. The rule itself was checked by hand, twice.
- The browser tests for the radio after a conflict and for the reachable disabled choice
  were not run against the old code.

## Consequences

- Fabrics, colourways and artwork have no screen yet. They come with steps 7 and 8.
- Until size charts arrive (owner action A5), a new design has no sizes and no
  measurements. The brand types its size run and its own values.
- The history lists the last 100 versions.
- Renaming a design, or changing its style number or season, is not a version.
