# 0035: One artwork layer model for any design

Status: Accepted
Date: 2026-10-14
Plan step: production outputs, W7a (`plans/production-outputs.md`)

## Context

The owner's correction of 2026-10-14: the platform must turn any design into production files, not only the polka-dot benchmark. That means every kit style, the club's own uploaded art, procedural styles, and designs read from a picture. Today a design holds a `kitPattern` (seven fixed styles, at most two colours), a list of `artwork` items and a `namesAndNumbers` block, and the flats, tech pack and exports each read those fields directly. Anything new would have to be taught to each of them.

## Decision

1. A design may carry one optional field, `artworkStack` (`lib/artwork-stack/schema.ts`): `{ schemaVersion, views[], colours[], layers[], colourways[] }`. It lives in the spec JSON. No database change; migration slot `20261015060000` stays unused.
2. A layer is one of `ground`, `pattern`, `image-fill`, `graphic`, `text`, `player-mark`, in blend order (the array order). Every layer has an id, one or more views, opacity, a blend (`normal`, `multiply`, `screen`, `overlay`, `knock-out`), an optional technique and a provenance. Normal and knock-out stay vector; the other three need pixels, so W3 builds a piece that uses one as a raster.
3. All patterns, old and new, are one layer kind behind a generator interface (`generator.ts`): an id, labelled settings with units and ranges, a repeat kind, and a pure `render(context)` that returns shapes in design millimetres. The seven existing styles are wrapped as `kit-hoops` and the rest by calling today's drawing code unchanged (`legacy/kit-styles.ts`). `dots` joins when W0b merges.
4. Everything is stored in design space (millimetres on a flat-lay plane per view), never in piece or 3D coordinates. A `PieceMapper` (interface only; W3 builds it) maps design space to a piece for one size, following decision 0034. Repeats hang from one datum per view (`datum.ts`), not from each piece.
5. Colours are a list with typed codes (`factory`, `pantone-tcx`, `pantone-tpg`, `ral`, `custom`). A code is whatever a person typed and is shown as theirs; no Pantone data ships (open item P6). A colourway maps colour ids to colours, so swapping it recolours the stack without touching a layer. A screen colour is for drawings only.
6. User assets are reached through an `AssetReader` interface (`assets.ts`), implemented by W7b. A vector asset is read as vectors; no SVG is ever stored or served.

### Migration: no data rewrite

- While `artworkStack` is absent, `deriveStack(spec)` works one out from `kitPattern`, panel colours, `artwork` and `namesAndNumbers`. A design with none of these derives a ground-only stack.
- `writeStack(spec, stack, specVersion)` is the dual write for a stack-aware editor: it stores the stack with `derivedFrom: { specVersion }` and sets the older fields from it with `toLegacy`, so the flats and tech pack keep working. Old versions are untouched (`spec_versions` is append-only).
- The older editor changes only the older fields, so the two can drift apart. `currentStack(spec)` uses the stored stack only while it agrees with the older fields; otherwise it works one out from them. The older fields win until a stack-aware editor writes again.
- What the older fields cannot hold (an image fill, a library pattern, a graphic from an uploaded asset) lives only in the stack and is left out of `toLegacy`.
- The flat draws from the stack only when the field is present (one line in `lib/flat/build.ts`). Every other design runs the code it runs today. A test proves that for every style, with and without a size and a second colour, and for designs with artwork and marks, the stack's flat is the same SVG as today's.

### Limits of this step

- The flat previews pattern layers only, in the normal blend at full strength. It still draws logos and names and numbers from the older fields. Opacity and blend are honoured by the print files (W3).
- A newer `schemaVersion` is refused with one plain sentence, never guessed at.
- `toPiece` returns `null` for a point that falls on no piece of that view; the plan's signature did not say what happens then.

## Alternatives

- Extend `kitPattern` with more styles: every new style or upload kind would touch the flats, the tech pack and W3.
- Store the stack in its own table: it is part of the design and must travel with each version of it; the spec is already append-only versioned.
- Rewrite stored designs to the stack: unneeded risk, and old versions must not change.

## Consequences

Easier: W3 renders one model; W7b, W7c and W7d fill it without touching W3; the tech pack can describe any design through `describeStack`. Harder: for a while two representations exist and are kept in step; `currentStack` makes the older fields win when they drift. Revisit when the stack-aware editor exists: retire the older fields only after the flats, tech pack and exports read the stack.
