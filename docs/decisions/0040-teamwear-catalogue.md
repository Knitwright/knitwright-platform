# 0040: Sports catalogue: football, cricket and one Australian winter code (V2)

Status: Proposed, with questions open for the owner
Date: 2026-10-24
Plan step: platform v4, workstream V2 (`plans/platform-v4.md`)

## Context

The spec's catalogue names football (shirt, shorts, socks, goalkeeper shirt, training top), cricket (coloured shirt, trousers, training tee, cap) and an Australian winter code the partner has not picked. The registry held tops, bottoms, outerwear and close-fitting only, so a design could not be made on any of these articles.

## Decision

1. **Three families, one per sport**: `football`, `cricket` and `winter-code`, labelled "Football", "Cricket" and "Winter code (Australia)". The new-design start screen groups articles by family label, so each article is listed under its sport with no change to the start screen. The family ids were added to `FAMILY_IDS`, the one closed list.
2. **Built from the existing families, not copied.** `registry/teamwear/compose.ts` builds a family from kits. The tops kit and the bottoms kit are the existing tops and bottoms data, referenced as they are. Where both define the same id (fit, thread and label slots, the cuffs panel and seam), the tops entry wins. A football shirt is a team jersey, shorts are shorts, a cricket shirt is a polo, a training top is a long sleeve tee: they offer only the choices the tops and bottoms drawing code can draw, and keep the same points of measure and panels. New data is only what differs: the goalkeeper's padded elbows, socks, the cap, and the winter code option.
3. **Winter code.** One article, `winter-code-top` ("Team top, winter code"). Its sport option has one choice, "Code not chosen yet", because an option cannot be empty. No code is named anywhere in the data (a test checks).
4. **Goalkeeper shirt.** Long sleeve by default. "Padded elbows" is an option, allowed only with a long sleeve (a proposed rule with a reason). Padding is a part to describe in the tech pack ("Elbow padding") and is not drawn on the flat.
5. **Socks and cap.** Socks have foot length, leg height, calf, ankle and top width. Their construction and seams are labelled "knitted, factory programme not supplied" and a "Knitting programme, not supplied" part says so in the tech pack. The cap has head opening width, crown height, peak length and peak width, a peaked or baggy shape and an optional back strap. Both use existing point groups (socks: leg, cap: body), so no screen needs a new section.
6. **Flats** (`lib/flat/families/teamwear/`). Shirts, tops and tees are drawn by the tops drawing code from the existing team jersey, long sleeve tee, polo and crew tee proportions. Shorts and trousers call `drawBottoms`. Socks and the cap have their own drawing, with the same layers, outline and callouts, and the same rules as every family: measurements drive the drawing, missing ones come from proportions and the drawing is marked not to scale, and measurements that cannot be drawn together are named. The sock is a straight symmetrical schematic with the foot in line with the leg, and the cap is drawn alike from the front and the back because the shared drawing checks expect every panel in both views; both are listed as owner questions. `artwork.ts` lists which panels show artwork in each view, so `sock-leg` and `cap-crown` were added there.
7. **Offered, but not at launch.** `LAUNCH_GARMENTS` stays as it is, because every entry in it must have a starter size chart and the tests enforce that. `isOffered` also accepts the teamwear ids, so they can be started. They have no size charts: every point of measure is `not set` until someone supplies a number, as the plan requires. Reusing the team jersey and shorts starter charts was left out, because nobody has said a football shirt is cut like a team jersey (question 13).
8. **Pattern library.** Each article has a slot that says "No pattern yet: needs a technician's draft or your DXF." Football socks are a knitting programme slot, like socks. No pattern service was called and no file was drafted.
9. **Not done here.** No migration. No new route or page. No change to intent words: the new articles are not yet known to the text and image intake, so "football shirt" in a chat prompt does not map to them; V8's `pending_catalogue` and a later wave own that. Kit patterns and artwork stacks are not drawn on the new articles' flats through the family drawer path, as for outerwear.

## Evidence

| Claim | Test |
|---|---|
| Every family passes the registry contract: sound data, no digits, valid starting designs, every panel seamed, every point and panel used | `registry/families.test.ts` (runs on every listed family) |
| The articles, labels, options, rules, parts and winter code behaviour | `registry/teamwear/teamwear.test.ts` |
| Every article draws both views, with and without measurements, closed, symmetrical, one silhouette, one opening, a callout per point, artwork at every anchor, snapshots | `lib/flat/families.test.ts` (runs on every drawn family) |
| Shirts and shorts are drawn exactly as the tops and bottoms they reuse; sock and cap behaviour | `lib/flat/families/teamwear/teamwear.test.ts` |
| Articles are listed under their sport, offered, and have no chart | `registry/teamwear/teamwear.test.ts` |
| A pattern slot for every article saying no pattern yet | `lib/pattern-library/slots.teamwear.test.ts` |

## Owner questions

`apps/web/lib/garment/registry/teamwear/OWNER-QUESTIONS.md`: the winter code, the sock programme and sizes, goalkeeper options, cricket cap blocks, trousers details, and which starter chart each article should start from.

## Consequences

- No new runtime dependency.
- A shared test that listed the four families, or assumed every offered garment has a starter chart, or that every article has at least eight points, was changed in the smallest way (see the PR).
