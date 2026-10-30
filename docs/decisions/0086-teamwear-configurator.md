# 0086: The teamwear configurator

Status: Proposed
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, wave 3, workstream Z5. Spec: `docs/spec/02-features.md` F-T1 (template gallery and
quick configurator). Reads decisions 0066 (the base article catalogue), 0071 (the factory model as data) and 0075 (the
editor shell and the slot contract).

## Context

F-T1 asks for a NOKTO-shaped configurator: a full-bleed 3D stage on a sport backdrop, a view chip, a vertical tool rail,
a right panel with kit-part pills and an accordion of decision rows showing catalogue codes, and a sticky footer with a
quantity stepper, the tier price with a discount badge, the total, Save, Quote and a way to order. Its acceptance tests
are a kit finished in ninety seconds, a first 3D render under three seconds, and a right panel that becomes a bottom
sheet on a phone.

Three things shape every decision below.

- **The Store is separate** (owner decision 1). The platform shows the price and hands the order over; it never takes
  money. So the spec's "Add to cart" cannot be built.
- **Manufacturable by construction** (spec decision 5). Every structural value on this screen has to come from the base
  article's approved options and parameter ranges, and only one of the eight launch articles has any
  (`JSY-SS-01`, decision 0066).
- **Two of the screen's buttons belong to workstream Z6**, which is not merged: the rail's "ideas" and the footer's
  "Quote".

## Decision

1. **The accordion's rows are the catalogue's own option groups, not the mock-up's row names.** The spec draws
   "Pattern & design (`Plain · P00`)" and "Collar & cuffs (`C01`)"; the catalogue holds the groups `collar`,
   `sleeve_finish` and `pattern_fill`. The rows are generated one per group, labelled from the group name, and each
   shows the chosen catalogue code and the rule that explains it (`R-CON-004` for C01, `R-CON-005` for C02). The
   catalogue wins because its group name and code are the reference the factory reads, which is the whole point of the
   spec's sentence "Codes come from the catalogue, so the factory and the club use the same reference". A new article
   with new groups needs no code.

2. **An out-of-range value is unreachable, and refused again.** Option rows are radios over the article's own codes and
   parameter rows are sliders whose ends and step are the article's (`body_length_offset` −30 to +40 in steps of 10,
   `R-PAT-003`). Every write goes through the editor's own `defaultsOver` (decision 0075), which drops a code the
   article does not offer and a value outside the approved range and falls back to the article's default. Nothing is
   duplicated: `lib/editor/form.ts` is imported, not copied.

3. **"Order through the Knitwright Store" is a hand-off, and the words say so.** There is no cart, no checkout, no
   payment and no storefront. The button produces a `KitHandoff`: a saved design version, its quantities, the currency
   and the total in integer minor units, and the tier the price was read at, so the Store can check the same tier. Beside
   it, every time: "Knitwright does not take payment here." A part the factory has no price for is left out of the
   lines and named in `omitted`, rather than holding the whole kit up. There is no Store address yet, so the button
   shows the reference `<projectId>@v<version>` instead of a dead link.

4. **The tier is read across the basket, and the footer says what the total leaves out.** `kitPrice` prices every part
   that has a base article through `priceBasket` (decision 0071), so twenty shirts and twenty shorts are both priced at
   the forty-piece tier and the figures match `priceFor` to the penny. The discount badge is measured against the
   smallest tier that carries a price in the chosen currency, which gives the spec's own `−24%` at the fifty-piece tier.
   The socks have no base article, so they have no price; the footer totals the parts that are priced and says
   "The total leaves out Socks, which has no price yet."

5. **Socks are a colour, because the catalogue covers no sock.** `football-socks` is a registry type with no base
   article (decision 0066's mapping table), so its row shows the colour and the model row says plainly: "No base article
   covers this part yet, so it carries a colour only: no options, no measurements and no price." Nothing is invented to
   fill the part.

6. **The sports are the three teamwear registry families, and a part a family has no type for is not offered.** Football
   has a shirt, shorts and socks; cricket has a shirt and trousers; the Australian winter code has one team top. The
   table is data in `lib/teamwear/vocabulary.ts`, so a family gaining a type needs no new code.

7. **A kit bundle arranges the club's colours and holds nothing structural.** Home is the main colour throughout, away
   swaps the first two, and the goalkeeper bundle uses the third. A club with two colours is told
   "A goalkeeper kit needs a third colour, so the keeper differs from both outfield kits" rather than given a colour
   nobody picked. Applying a bundle settles the colour row on every part at once, which is what lets a club finish a kit
   inside the spec's ninety seconds.

8. **Nothing is stored until Save, and one press saves one part.** A configurator that saved on every colour tap would
   make a design version per tap. The undo stack is therefore a list of whole kits in the browser (`history.ts`, capped
   at fifty), and Save stores the part showing as a design in the club's colours, as one version. A kit of three parts
   becomes a design per part, because a design in this platform is one garment and no row groups three of them.

9. **"Design in Studio" carries the form in the address.** The design holds the colours; the base article's option codes
   and parameters travel to the Y2 editor through its own `withEditorState` (`?rail=form&view=3d&opt=collar:C02&…`),
   because no change in the design contract writes a base article's parameters (decision 0075 and its owner question).
   The editor reads them back with `readAddress` and re-drafts, so the editor opens the kit the club just configured.
   Pressing "Design in Studio" on an unsaved kit saves it first, so the editor always opens a stored version.

10. **The stage is drawn from the same code every other surface uses.** `lib/teamwear/preview.ts` makes the part's design
    in memory and draws it with `lib/projects/flat-preview`, which is what the editor and the tech pack use, so the
    stage, the editor and every export show the same version identically (spec F-S9). It runs on the server for the
    first picture and in the browser for every change after it, which is why a colour answers at once.

11. **The stage has its own three.js scene, and the architecture test says why.** `components/garment3d/scene.ts` offers
    two views (front and back) and the view chip needs five, so `components/teamwear/stage-scene.ts` places the camera
    for Front, Back, Left, Right and Collar. Both it and `KitStage.tsx` sit in the chunk the configurator fetches with
    `next/dynamic`, and `tests/architecture/garment3d.test.ts` now asserts that dynamic import, so the rule it exists for
    — no page loads 3D code until a stage is on the screen — still holds.

12. **The first render budget is a test, and the stage reports its own measurement.** The stage writes the milliseconds
    from the moment the page was asked for to its first drawn frame onto itself as `data-ready-ms`, the browser test
    holds that number under `FIRST_RENDER_BUDGET_MS` (3,000), and the screen itself says so when it is over budget. The
    backdrops are CSS gradients, so nothing is fetched and no third-party picture is stored.

13. **The angles and backdrops are framing, not measurements.** The camera angles, the turntable's twelve seconds and the
    backdrop gradients never reach a pattern, a print file or a tech pack. Nothing turns by itself for a person who has
    asked their device for less motion.

14. **Z6's two buttons are shown and say plainly that they are not ready.** `lib/teamwear/ideas.ts` holds the smallest
    interface for each — `IdeasSource` and `QuoteSource` — with an `unavailable` implementation and a deterministic
    double (`fixedIdeas`, `fixedQuote`). Nothing imports from Z6's directory. An idea can only ever be colours and a kit
    style, never a picture, so AI still never draws the garment (spec decision 13).

15. **The element slots are the ones the spec fixes, and the row says what is missing.** A crest, three sponsors and one
    text element. Where each one sits comes from the base article's placement table, which the catalogue does not carry
    (decision 0066 stores no placements), and the artwork itself is added in the Studio editor. The row says exactly
    that and cites `R-SUB-004` for the fifteen-millimetre seam rule. Nothing is placed on a guess.

## What was left, and why

- **No crest or sponsor upload.** The configurator records which slots a kit uses; the file goes in through the Studio
  editor's own artwork tools. Placing a crest needs the article's placement boxes, which the catalogue has no column
  for, and inventing a position would be an invented measurement.
- **No kit entity.** Three parts are three designs. Grouping them is a table, and this workstream needed no migration.
- **No printed kit pattern (hoops, stripes, a sash).** `lib/kit-styles/presets.ts` offers its styles for the studio types
  (`team-jersey`, `crew-tee`) and not for the teamwear ones (`football-shirt`, `football-shorts`), so
  `kitStyleActions` refuses every part of a kit. The configurator therefore colours the body in the club's main colour
  and the trims in its second, with the same panel roles that file uses, and the catalogue's `pattern_fill` group
  (`P00` plain, `P01` vertical stripes, `P02` diagonal gradient) is the pattern decision the club makes. Owner question
  below.
- **One market at a time.** The currency comes from the catalogue's own market selector (`?market=au`); choosing a
  factory per article and per market is a later wave's job, as decision 0071 says.

## Rules with no entry (`R-GAP-000`)

The rulebook has no entry for: the Store hand-off itself; the largest order the configurator takes; which backdrop a
sport is shown against; who a kit is made for; a kit part with no base article; and the first render budget. Each one
carries `R-GAP-000` in code and is listed on the pull request.

## Owner questions

1. **Should a kit be a row of its own**, so one press saves the shirt, the shorts and the socks together and one link
   opens the set? Today three parts are three designs.
2. **Should `lib/kit-styles/presets.ts` offer its styles for the teamwear registry types?** Until it does, no teamwear
   garment can carry hoops, stripes or a sash, and the configurator duplicates that file's panel roles to colour a kit.
3. **What address should "Order through the Knitwright Store" open** once the Store exists? It shows a reference now.
4. **What is the largest order the configurator should take without a conversation?** The stepper stops at ten thousand
   pieces, which is a limit on the control and not a factory limit: no row says what one order may hold.
5. **Should `ProposalSource` gain a `teamwear` member?** A kit saved here is filed as `kit-style`, whose history note
   reads "Picked from the kit styles", because that closed list is in another workstream's file.
6. **Is a sock article coming?** Until one exists the socks of every kit are a colour with no price, which is the one
   part of the spec's kit bundle the platform cannot quote.
7. **Does a base article get a placement table?** Without one the crest and sponsor slots can be recorded but not
   placed, and step 4 of the F-T1 flow stays in the Studio editor.
