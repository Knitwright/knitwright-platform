# 0079: Brand Studio, typed by hand

Status: Proposed
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, wave 2, workstream Y6. Spec: `docs/spec/02-features.md` F-S9 (without the URL
import, which is wave 4, L7) and F-T2 (the crest palette, which wave 3's Z6 shares). Builds on decisions 0024 (brand
details), 0036 (the brand's own uploads), 0042 (the club workspace and its roles), 0056 (platform settings) and 0067
(the rulebook behind every "Why?"). Owner decision 15 binds the colour numbers.

## Context

F-S9 asks for a brand record per workspace — details, named palettes, fonts by role, logos and graphics, a written
visual style, voice and tone, and a Sportswear set — applied everywhere, with a completion % in the top bar. Two parts
of it are shared on purpose: the crest palette is the one crest-to-kit (F-T2) uses, and the colour and font pickers of
the editor (Y3) and of the launch work (wave 4) all need the same Brand tab.

Three things the brief forbids made the shape of this workstream: no invented measurement, no invented licence, and no
loss of the `club_kits` data a club has already entered.

## Decision

1. **Six tables** (`supabase/migrations/20261110010000_brand_studio.sql`):

   | Table | Holds |
   |---|---|
   | `brand_studio_fonts` | The licensed kit-font list: key, label, CSS family, licence, licence note, selectable, position. Platform data |
   | `brand_profiles` | One row per brand: category, kind (generated), website, about (1,000), voice tags, the three visual-style texts, default size range |
   | `brand_palettes` | A named palette of a brand, with a position |
   | `brand_colours` | One colour: name, `#rrggbb`, Pantone TCX **as typed** |
   | `brand_fonts` | Brand × role → a key of `brand_studio_fonts` |
   | `brand_assets` | Brand picture: kind (logo, graphic, crest, sponsor, label, packaging), a `user_artworks` id, label, sponsor name, print width mm, position |

   `kind` on `brand_profiles` is a **generated column** (`club` for the `club` and `school` categories, `brand`
   otherwise), so the kind and the category can never disagree. The five brand tables are brand-scoped with row level
   security on, readable by members through `private.is_member`, with **no insert, update or delete policy at all**;
   `brand_studio_fonts` is readable by any signed-in person and by no visitor. Every write goes through a
   `brand_studio_*` SECURITY DEFINER function that checks the caller's role with `private.can_manage_kit`
   (decision 0042: owner, admin or kit manager, never a viewer). The service role holds **SELECT only** on all six and
   EXECUTE on the five functions. Limits (12 palettes, 24 colours, and per kind 12 logos, 60 graphics, 1 crest,
   3 sponsors, 6 labels, 6 packaging) are `private.*_limit` functions, not literals in TypeScript.

2. **`club_kits` is READ THROUGH, not migrated.** Nothing is copied and no row is moved. `club_kits` stays the one
   place a club's colours, crest and sponsors live: `/club` writes it through `save_club_kit`, `lib/clubs/apply-kit.ts`
   applies it to a design, the two-click reorder reads it (decision 0065) and `lib/deletion/team-data.ts` erases it.
   `lib/brand-studio/club-kit.ts` turns what it finds into a palette named "Club kit" and into Sportswear pictures,
   both marked `source: "club-kit"`, shown read only with the line "From your club kit. Change it on the Club page.",
   and **counted towards the completion %** because they are real values a person entered.

   Why not migrate: a copy would be a second row meaning the same thing, and the two would drift the first time
   somebody edited either one — a club would then see different colours on `/club` and in Brand Studio, with no way to
   tell which was right. A read-through cannot lose anything, because nothing moves. The cost is that the club kit's
   three colours cannot be renamed or given a Pantone code in Brand Studio; a club that wants that adds its own palette
   beside them, which the Colours tab offers. The database test asserts both halves: the kit is still in `club_kits`
   after Brand Studio has saved a palette of its own, and `brand_colours` holds no copy of the kit's colours.

3. **No invented licence.** A font may be chosen only when this repository can show its licence, and
   `brand_studio_fonts` enforces exactly that in the database: `check (selectable = (licence = 'bundled'))`. The only
   fonts whose licence is on file are the two bundled Geist faces — the `geist` npm package carries the SIL Open Font
   License 1.1 at `node_modules/geist/LICENSE.txt`, and `app/layout.tsx` already ships them. The other four rows are
   **labelled placeholders** (`licence: 'not_established'`, `selectable: false`) whose note reads "Placeholder, not
   reviewed by anyone. No licence for a font of this kind is on file, so it cannot be chosen yet." The Fonts tab shows
   them disabled with that note, and `brand_studio_save_fonts` refuses one with `hint = 'font_not_licensed'`. The
   owner question is on the pull request.

4. **The gamut warning is computed, never guessed.** `lib/colour/palette.ts`'s `nearestSublimationSafe` works in CIE
   Lab through `lib/print/rules/colour` (the platform's own D65, 2-degree convention, owner decision 15) and tests each
   candidate against `isInsideApproxGamut` in `lib/guardrails/gamut.ts`. A colour the estimate refuses keeps its
   lightness and hue and has its chroma pulled in a hundredth at a time until the estimate accepts it; the brand is then
   shown that colour, the CIE76 difference, and a sentence that says it is Knitwright's own estimate with no ICC
   profile behind it. **This is not a measurement**, and `lib/brand-studio/wording.test.ts` fails if any sentence about
   it drops the word "estimate".

5. **No Pantone data ships** (open item P6, as `lib/design-object/colours.ts` already records). `pantone_tcx` is
   whatever the brand typed, or null. Nothing ever works a Pantone code out from a screen colour, and
   `wording.test.ts` fails on the phrases "nearest Pantone", "matching Pantone" and "Pantone match". A colour with no
   code carries a note, under `R-SUB-005`, that a factory has nothing to match to yet.

6. **No invented print width.** The rulebook gives the resolution (`R-SUB-003`: 150 DPI at 1:1) but **no sponsor or
   crest print width**, so the DPI check never assumes one. A picture whose width the brand has typed gets a real check
   against that number; a picture whose width it has not gets the largest width at which the file still meets 150 DPI,
   and the sentence "How wide it will be printed is still yours to set". A vector warns about nothing, and every raster
   carries R-SUB-003's own best practice: upload the drawing where you can.

7. **Every finding carries a rule.** `R-SUB-003` for resolution and vector preference, `R-SUB-005` for the printed
   strike-off, and **`R-GAP-000` for the sublimation gamut**, because the rulebook has no entry for which colours a
   press can reach — R-SUB-005 says a colour is compared with a printed strike-off, which is a different claim. The
   gamut finding is shown with "R-GAP-000 · no rulebook entry for this yet", and the gap is listed on the pull request.

8. **`lib/colour/palette.ts` is shared with F-T2 on purpose.** k-means in CIE Lab over a picture's colours, weighted by
   how many pixels hold each, deterministic: the first centre is the commonest colour, the rest come from k-means++
   driven by one seeded generator, and the loop stops when no colour changes cluster. Z6 calls `extractPalette` rather
   than writing its own, so the two screens can never disagree about a crest. `crestPalette` in
   `lib/brand-studio/crest.ts` only decodes a stored screen copy into pixels and pairs each swatch with the estimate.
   It **saves nothing**: the swatches fill the rows in and the brand presses Save, so every colour in a brand's palette
   is one a person chose.

9. **`<BrandTab>` is a documented, stable interface** (`components/brand-studio/BrandTab.tsx`). Purely presentational:
   it fetches nothing, writes nothing and knows no route; every field is `readonly`; fields are only ever added, and
   anything added is optional with a safe default. A colour row carries `hex`, `safeHex`, `inGamut` and the warning,
   worked out on the server, so no picker computes a colour of its own; a font row carries its licence and note, so no
   picker can imply a licence. `lib/brand-studio/brand-tab.ts` builds the rows from a `BrandRecord`.

10. **The completion %** is seven weighted steps over what the brand has actually said (details, logos, colours, fonts,
    graphics, visual style, Sportswear). The weights are Knitwright's own and are labelled "Knitwright's own weighting,
    not reviewed by anyone" wherever the number is shown. Nothing counts because something was guessed for it.

## Consequences

- A brand gets `/brand-studio` with the seven tabs of F-S9 as links, so each tab has its own address and the page works
  without scripts. The top bar gains a completion pill beside the brand name the header already showed; it reads the
  brand itself inside its own Suspense boundary, so the page shell never waits for it.
- Wave 3's Z6 must import `extractPalette` from `lib/colour/palette.ts` rather than writing its own k-means, and wave
  4's L7 fills the same six tables from a URL instead of by hand.
- Y3, Y8 and wave 4 reuse `<BrandTab>` and `brandTabColours` / `brandTabFonts`.
- `lib/brand-studio/assets.ts` repeats the dpi default and its label rather than importing
  `lib/guardrails/settings.ts`, because that module reaches the schema library and the Sportswear panel runs the check
  in the browser (`tests/architecture/client-weight.test.ts`). A test asserts the two agree, so they cannot drift.
- `default_size_range` holds a cardinality check only; each label's shape is checked in
  `brand_studio_save_profile`, because a check constraint cannot look inside an array without a function Postgres
  treats as stable.

## Owner questions

1. **Kit fonts.** Only the two bundled Geist faces have a licence this repository can show. A kit-font list worth the
   name needs a block or condensed sans for names and numbers. Which faces should be licensed, and for which use —
   screen, sublimation print, and the factory's own RIP? Until then a brand can set only Geist, and the four
   placeholders say plainly that no licence is on file.
2. **The sublimation gamut.** Owner decision 15 already asks the colour house for its white point and observer. The
   same request should ask for an **ICC profile**: the gamut shown here is Knitwright's own chroma estimate
   (`lib/guardrails/gamut.ts`), and with a profile it would become a real soft proof and `R-GAP-000` would become a
   rulebook entry.
3. **Pantone.** No Pantone data ships (open item P6), so a brand types its own TCX codes and nothing is ever matched
   for it. Should Knitwright licence the TCX library, or keep asking brands to read their printed swatch book?
4. **Sponsor and crest print widths.** The rulebook gives no width for either. Should the factory supply a standard
   chest-sponsor and crest width per article, so the DPI check can run without the brand typing a number?
