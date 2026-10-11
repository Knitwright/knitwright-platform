# 0027: Beta scope, and player names and numbers

Status: Accepted. Which garments launch and the 3D verdict are asked in apps/web/lib/config/OWNER-QUESTIONS.md.
Date: 2026-10-11
Plan step: wave 3 (Platform and Store Guide, 2026-10-10)

## Context

The owner's Platform and Store Guide (pages 6 and 7) launches with nine club products and
leaves leggings, sports bras and rash guards to a second wave "only after the first one sells".
The studio already has registry models, flats and rules for leggings, the sports bra and the
compression top (decisions 0016, 0017, 0021). The 3D view (decision 0014) is a trial still
waiting for the owner's verdict (A10).

## Decision

### Part 1: what the beta offers

1. **One list decides which garments a new design may start as**:
   `LAUNCH_GARMENTS` in `apps/web/lib/config/launch-garments.ts`. It is an allow list, so a
   garment added to the registry later stays hidden until it is listed. Leggings, sports bra
   and compression top are left out.
2. **Every way to start a new design reads it**: the garment lists on `/studio/new` and
   `/studio/start` (`garmentTypeGroups`), the server schemas behind them (`offeredTypeSchema`),
   and a guided start from words, which answers "Not offered yet: Leggings." instead of
   starting another garment.
3. **Plain-English edits and pictures say it too.** Words that name a hidden garment are
   answered before any model is asked, at no cost. A change, question choice or picture
   reading that turns a design into a hidden garment is refused or taken out
   (`lib/intent/launch-scope.ts`), and the model is shown only offered types. A browser change
   of type to a hidden garment is refused by the server.
4. **Existing designs are untouched.** A design that already is a hidden garment opens, edits,
   keeps its type, and gives its tech pack and every export. No code, data or test of those
   garments was removed. The golden sets keep testing them: they call the resolvers directly,
   below the launch check, because they test reading words, not what is on sale.
5. **The 3D view is behind a server switch**, `SHOW_3D`, shown only for the exact value
   `true` and off by default. Its code, tests and the architecture guard stay.

## Evidence

Unit tests: `lib/config/launch-garments.test.ts`, `lib/intent/launch-scope.test.ts`, and
cases added to `lib/guided/start.test.ts`, `lib/intent/text-flow.test.ts`,
`lib/projects/schemas.test.ts`, `lib/projects/type-groups.test.ts`, `lib/config/env.test.ts`.

## Alternatives

- A deny list of hidden garments: one edit to re-enable as well, but a new registry type would
  appear in the beta unasked.
- Removing the hidden garments from the registry: breaks existing designs and throws away work.
- Hiding the 3D view with a build flag (`NEXT_PUBLIC_`): needs a rebuild to change; a server
  variable needs a restart only.

## Consequences

To offer a garment, add its id to `LAUNCH_GARMENTS`. To show 3D, set `SHOW_3D=true`. The
golden sets no longer describe exactly what a beta user sees for hidden garments; the launch
check sits above them.
