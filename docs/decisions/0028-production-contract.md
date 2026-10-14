# 0028: The production contract

Status: Proposed
Date: 2026-10-14
Plan step: `plans/production-outputs.md`, workstream W0a

## Context

Seven workstreams (pattern library, sizes and fabrics, print files, orders and releases, tech
pack v2, a 3D spike) are to run in parallel in separate branches. Without one set of types and
fixtures they would each invent the shape of a pattern piece, a fabric value or a release, and
the merge would be the work. The fashionINSTA benchmark (`docs/owner/reference/fashioninsta-2026-10-14/`)
also showed what the types must make impossible: a DXF that does not say whether seam
allowance is in the outline, and a tech pack that states values its own DXF contradicts.

## Decision

1. **One contract in `apps/web/lib/production/contract/`**, Zod schemas with their types, one
   file per area: pieces, fabric, sizes, print, orders, release, readiness. After W0a merges, a
   change goes in a small additive PR labelled `contract`.
2. **Nothing is guessed in the types.** A seam allowance has a size exactly when its source
   states one; an outline says whether it holds the allowance (`unknown` is a value); a fabric
   value is empty exactly when it is `not-set`; only a `fabric-test` or `supplier-sheet` value
   may scale artwork, and the result says "Not scaled for shrink" otherwise.
3. **A new provenance, `measured-from-pattern`** ("Measured on the pattern"), for numbers read
   from a pattern piece's geometry. It is styled as derived. There is still no "verified".
4. **Fixtures converted once from the benchmark DXFs** (`lib/production/fixtures/`): the four
   pieces of the tee and of the jersey at EU 48 as a `GradedPattern`, a polka-dot jersey design,
   and a 22-player roster with fictional names. The pattern library's reader must reproduce
   them exactly. Their tests re-derive the plan's section 1 values to 1 mm.
5. **Plumbing that several workstreams share is done once**: file kinds `print`, `proof`,
   `roster`, `pattern-source` and the exports bucket's types (migration `20261015000100`), one
   `storeProductionFile` helper that checks bytes against the stated type (and refuses scripts in
   SVG), six rate limits, 90 % coverage thresholds for the new `lib/` directories, a "Make it"
   tool in the workspace with four stub panels.
6. **One new dependency, `clipper2-ts`** (BSL-1.0), for seam allowance and bleed, used only
   through `lib/production/geometry/offset.ts`. Reasons are in `docs/launch/licences.md`.

## Evidence

Fixture tests in `lib/production/fixtures/fixtures.test.ts` re-measure the benchmark pieces:
body length 72.0 / 68.7 cm, shoulder 10.6 / 10.4, front drop 9.6 / 9.8, back drop 2.6 / 2.7,
chest 50.7, hem 51.9, sleeve length 20.5, cap height 13.8, sleeve opening 17.3. Contract and
`printScale` tests give 1.0204 by 1.0152 for a 2.0 % and 1.5 % shrink.

## Alternatives

- Types in each workstream, reconciled at the end: rejected, it recreates the merge conflicts
  the plan is built to avoid.
- Sharing the database through foreign keys: rejected by the plan; a release holds an immutable
  JSON snapshot, so migrations merge in any order.
- Other offsetters (`polygon-offset`, WASM Clipper ports): see `docs/launch/licences.md`.

## Consequences

Workstreams import types, not each other. A contract change touches every workstream, so it is
small and additive. Units: stored measurements stay integer tenths of a millimetre; pattern
geometry is millimetres as floats, rounded to 0.01 mm when written.
