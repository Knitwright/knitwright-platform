# 0037. Pattern generators: many looks, one interface (W7c)

Status: Accepted. Date: 2026-10-14.

## Context

The platform drew seven fixed kit styles and, from W0b, polka dots. The owner's correction of 2026-10-14 is that
the polka-dot jersey was an example, not the product: any look must be possible, and a club must be able to tweak it,
and the assistant must be able to set it from plain words. W7a (decision 0035) fixed the interface a pattern
implements and the display list it returns. This decision records how the library behind that interface works.

## Decision

1. **One interface, one registry.** Every style implements W7a's `PatternGenerator`. `lib/pattern-generators/registry.ts`
   lists all of them (`GENERATORS`, `getGenerator`, `tileSizeFor`). The eight older styles are W7a's adapters, the same
   objects, so their drawing is today's drawing; W7a's files are not edited. W3 and W7d import the registry and read it only.
2. **Nine new styles:** camo, geometric (chevron, diamonds, triangles, hexagons), colour fade (smooth, round,
   stepped, any angle, two to four colours), halftone dots, checks, gingham, houndstooth, brush strokes, and stripe
   variations (even, graduated, double, irregular, any angle). The old fade is also a preset of the new fade.
3. **Deterministic by construction.** Pure functions. No `Math.random`. One small integer generator (`prng.ts`, a
   splitmix style mixer on 32 bit integers). All coordinates are rounded to 0.01 mm when a shape is made. A test
   fingerprints the display list at 0.01 mm and compares two runs.
4. **Fields are continuous, tiles repeat exactly.** A *field* style is laid out on the whole design plane: its shapes belong
   to whole-number cells counted from the datum, and each cell is seeded from its own position (`hashSeed(seed, layer,
   i, j)`), so any area draws the same shapes in the part they share. Drawing a piece and its two halves gives the same
   colour at every sampled point, including either side of the line where the halves meet. A *tile* style declares its
   tile size (`tileFor`, since the size depends on the settings; `repeat.tileMm` is the tile at the defaults) and puts
   copies a whole number of tiles from the datum, with corners rounded to 0.01 mm, so opposite tile edges match exactly.
5. **A seed is a new arrangement for every style.** Camo and brush strokes draw from it. For the styles with no random
   part, a seed other than 0 moves the pattern by a seeded part of one repeat; seed 0 leaves it on the datum.
6. **Shape budget: 20 000 per piece** (a setting, as in the plan, not a measurement). A generator estimates its count
   first and, over budget, draws larger shapes and says so in `DisplayList.note`. Each setting at its smallest and its
   largest, and a very large area at the smallest settings, stay inside the budget (tested).
7. **Settings.** Each has a unit, range, step, default, plain label, and plain words for up and down ("bigger", "tighter",
   "busier"). A pick-one setting (the shape, the stripe rhythm) is a position with `choices` naming each. These extra
   fields are a subtype of W7a's `ParamSpec`; no change to the contract. Out-of-range values are clamped.
8. **The assistant moves a setting by its own step.** `assistant.ts` gives the schema and turns words into steps ("a lot"
   is three steps, otherwise one). A step past an end of the range stops there and says it ("Largest camo blob is 12
   cm."). `lib/intent/artwork-style.ts` reads "make the camo bigger and darker green" with no model, changes the layer's
   settings and shades the matching colour of the first colourway, and returns before and after for each. Only the screen
   colour changes; a typed factory code is not touched, and the sentence says so.
9. **Presets:** three per style in `presets.ts`. The older `lib/kit-styles/presets.ts` is only read.

## Consequences

- W3 asks any style for its display list over a piece's bounds plus bleed on the shared datum and needs no style-specific code.
- W7d fits a style's settings to a picture through `getGenerator`, `assistantSchema()`, `colourAt` and `displayListHash`.
- Gradient bands, rings and halftone dots are many small vector shapes, not a gradient fill, because the display list holds
  only polygons and circles. The shape budget bounds them.
- Wiring the assistant's pattern change into the editor needs a change type that carries a stack (`lib/garment/**`) and an
  entry in the reply schema (`lib/intent/reply-schema.ts`). Neither belongs to W7c, so `artwork-style.ts` stands alone and
  is exported by one line in `to-spec-action.ts`. This is open until those files' owners add the two lines.
- The 90 % coverage floor for `lib/pattern-generators/**` is met (see the pull request); adding the directory to the
  thresholds in `vitest.config.mts` is W0's file.
