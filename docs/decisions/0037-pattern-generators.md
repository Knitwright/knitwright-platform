# 0037: Pattern generators

Status: Accepted
Date: 2026-10-14
Plan step: production outputs, W7c (`plans/production-outputs.md`)

## Context

Decision 0035 made every pattern a generator behind one interface (`lib/artwork-stack/generator.ts`) and wrapped the eight styles that exist (hoops, stripes, pinstripes, sash, side panels, chest band, fade, dots) so a design draws as it always has. The owner's correction of 2026-10-14 asks for any design, not only polka dots. That needs many more looks, each one a few settings a club can change and an assistant can set from words.

## Decision

1. `lib/pattern-generators/` is the one list of generators (`registry.ts`: `ALL_GENERATORS`). It holds the eight older styles under the ids and drawing they have always had (`kit-hoops` and the rest), and seven new generators: `camo`, `geometric` (chevron, diamonds, triangles, hexagons), `gradient` (linear, radial, stepped, any angle, 2 to 4 colours), `halftone`, `checks` (check, gingham, houndstooth), `brush` and `stripe-rhythm` (even, graduated, double, irregular, at any angle). The old fade is a preset of the gradient; `kit-fade` stays for designs that already use it.
2. **The older styles are not rewritten.** They keep their code in `lib/artwork-stack/legacy/kit-styles.ts`, which calls today's drawing. The registry re-lists them, and a golden test pins a hash of each style's output (3 contexts each, taken before the move) so any change to a saved design's drawing fails a test. `lib/artwork-stack/registry.ts` now takes its list from the library (one import, the only edit to W7a's files).
3. **Rules every generator follows.** Pure; no `Math.random`; one small seeded generator shared by all (`rng.ts`: a 32 bit mix and mulberry32), with one stream per cell of the pattern so the result does not depend on the order or the bounds drawn; geometry at 0.01 mm; at most 5 colours, taken from the colours given and repeated when fewer are given; a shape budget of 20 000 per piece after which it draws fewer, larger marks and says so in the display list's `note`.
4. **Repeat.** Six of the new generators are `field`: their cells hang from the view's datum, so drawing the left and right halves of a plane gives, point for point, what drawing the whole gives (tested by sampling the colour at the seam). `checks` is `tile`: its tile is 2 bands each way (`tileOf(params)` says the size for given settings) and opposite edges match (tested). `seed` 0, the default, hangs a lattice exactly from the datum; another seed slides it by under one cell, so the same settings can be placed differently. The gradient has nothing random and ignores the seed.
5. **Settings.** Each has a unit, range, default, step and a plain label, and a list of plain words for up and down. A setting that picks from a list (the shape, the kind of check) is stored as the number of the choice, because the interface's settings are numbers; `choices.ts` gives each choice its name, and the assistant picks by name. A setting out of range is kept within its range when drawing and never stops the drawing.
6. **The assistant** (`assistant.ts`, `lib/intent/artwork-style.ts`) moves a setting by whole steps (`stepParam`), says before and after, and when the end of a range stops a step it says so ("Largest camo blob size is 12 cm."). "Darker green" lightens or darkens the pattern's colour of that hue by one fixed step. The model never gives a number. Everything changed is marked `ai-suggested`.
7. **Presets.** Three named presets per generator that has settings (`presets.ts`); the fixed fade has none.
8. A gallery component (`components/artwork/generators/`) draws each preset small and reports a pick.

## Evidence

- `lib/pattern-generators/*.test.ts`: the older styles' output equals the output captured before the move; for every generator the same seed and settings give the same list, another seed changes it, each setting at its minimum and its maximum stays within the budget, settings out of range and missing colours do not fail; `field` generators are continuous across a seam, `tile` generators repeat; the display lists of the new generators are pinned by hash (a different hash on another machine or Node version fails the test in CI).
- `lib/intent/artwork-style.test.ts`: "bigger and darker green" becomes a step with a before and after and a darker green; a step past the range is cut and said.

## Alternatives

- Rewrite the eight styles as new code: risks changing saved designs for no gain.
- Draw gradients with a gradient fill: the display list has solid fills only, and a banded gradient prints the same on every RIP.
- A string type for list settings: needs a change to the shared interface; the number of the choice plus a name table needs none.
- Seed every generator: a gradient has nothing to vary; a seed that does nothing would mislead.

## Consequences

- Adding a look is one file and one line in the registry; W3 never changes.
- Display lists may extend past the piece (the radial gradient's rings); the cut to the piece is W3's.
- The assistant action `set-artwork-style` is written and tested, but is not yet reachable from a chat reply: `to-spec-action.ts` converts to the editor's changes, and none sets an artwork stack yet. When one exists, it is one line there and one in the reply schema.
- Revisit if a print house wants smooth gradients (a raster layer), or if the 20 000 shape budget proves too low on large pieces.
