# 0106: The launch panels no workstream owned, and L7's import screen

Status: Proposed. Three of the four unowned rail panels are built, Likes is deliberately a labelled placeholder
because nothing records a like, the import screen saves everything except a picture, and the owner questions below
are open.
Index: Proposed; Templates, Uploads and Brand built, Likes an honest placeholder because nothing records a like, L7's import screen wired, three R-GAP-000 entries, owner questions listed
Index title: The launch panels no workstream owned
Date: 2026-11-02
Plan step: a gap in `plans/platform-v5.md` itself, not a step of it. Spec: the Launch shell of `docs/spec/02-features.md`
(Templates, Likes, Uploads, Brand) and F-S9 phase 3 "Import your brand". Builds on decisions 0091 (the panel
contract), 0098 (the template library), 0102 (brand import from a URL), 0079 (Brand Studio) and 0036 (the brand's own
uploads and the rights tick).
Migration: none.

## Context

L1's panel contract (`apps/web/lib/launch/panels.ts`) names a workstream for every panel of the launch shell's icon
rail. Four of them name a workstream the plan **never gave a component path**:

| Panel | `panels.ts` says | What that workstream was actually given |
|---|---|---|
| `templates` | workstream L8 | `lib/templates/seed/**` and `lib/templates/kinds/**` — no components |
| `likes` | workstream L8 | the same |
| `uploads` | workstream L7 | `lib/brand-studio/import/**` — no components |
| `brand` | workstream L7 | the same |

Both workstreams noticed and stopped at their boundary rather than reaching outside it. L8's record says plainly that
`components/templates/**` and `lib/templates/filters.ts` "belong to no wave-4 workstream and were not edited", and
left `matchesTags`, `matchesSearch`, `TAG_CHOICES` and `gapForType` as pure functions "ready for the panel that shows
them". L7 built a complete, tested view model (`lib/brand-studio/import/view.ts`) and wrote the renderer's contract
into decision 0102 item 10, because "L7's section of the plan owns `lib/brand-studio/import/**` and no component or
route". Both were right to stop. This record is the work nobody owned.

## Decision

### 1. Three panels are built, in `components/launch/panels/**`, and mounted the way L2's and L4's are

`LAUNCH_PANEL_COMPONENTS` is this work's own registry, in its own file, spread into the `BUILT` map of
`components/launch/RailPanels.tsx` — the same arrangement as `components/marketing/panels.ts`, for the same two
reasons: one map made once, so nothing is looked up by calling a function while the shell renders
(`react-hooks/static-components`, the rule the wiring of decision 0105 ran into), and two workstreams adding panels do
not conflict on one registry. Each panel is a default export taking exactly `LaunchPanelProps`, so the shell can load
it with `next/dynamic`, and each one is tested against `panelDouble()` with no shell and no browser.

`components/launch/Inspector.tsx` is **not** touched: the two board panels left unmounted are `board-ai-image` (L3's)
and `board-ai-video`/`board-info-card`, which the wiring step owns.

### 2. The search and the five filters run on the server, because L8's own functions may not reach the browser

`matchesTags`, `matchesSearch` and `TAG_CHOICES` live in `lib/templates/kinds/tags.ts`, which imports
`lib/templates/catalogue.ts` and `lib/templates/colour-family.ts`, which import `lib/garment` — and from there zod.
`tests/architecture/client-weight.test.ts` refuses a client component whose imports reach zod, and `gapForType` reaches
it a second way through `lib/catalogue`.

So the alternative was a second filter written for the browser, and two filters that can disagree is worse than one
round trip. `GET /api/launch/templates` runs L8's functions and hands the panel rows that are already narrowed, with
one chip per choice and the count behind it; the panel keeps the previous answer while the next is in flight, so
typing never empties it and the chips never flicker away under the cursor. The read is debounced at 250 ms.

**The read names the kinds it can draw.** `lib/templates/service.ts` warns that `templates` holds seven kinds and that
a reader which expects a design must ask for `kind = 'design'`. A card here names the garment a design is drawn on and
what that garment has no data for, which only a design row can answer, so `PANEL_KINDS` is `["design"]` and the read
uses `.in("kind", PANEL_KINDS)`. A test records what the read was narrowed to. The panel says in its own words why the
library's other six kinds are not listed twice: a marketing template opens on a Marketing board, a mockup scene is in
the Mockups panel, and a flow is started from the canvas.

**A template whose article has gaps says so.** `gapForType` answers from the register of decision 0090: seven of the
eight launch articles publish no point of measure and no block, so most cards carry
"No measurement on file for this garment yet" with that article's own rule id rather than looking ready to make.

**The one action is the one that already exists.** `useTemplateAction` copies the template into the member's own brand
as a new design and opens the editor on it. A design template cannot be laid onto a launch canvas — a launch project
launches a design that already exists (`LaunchProjectView.designProjectId`) — so the panel says plainly that starting
a design opens the editor and leaves the canvas as it is, rather than letting a person find that out.

### 3. The Uploads panel shows the record and nothing more

`user_artworks` is where a brand's own pictures live, and every row carries exactly three rights columns: who said it,
when, and the version of the words they saw. `lib/artwork-intake/records.ts` deliberately drops those three on the way
to a screen ("kept for records, not for screens"), so this work reads them itself rather than widening a shape five
other screens share.

The row shows the day and, when this repository still holds that version of the wording, the sentence that was on
screen; a version it no longer holds shows nothing rather than putting a sentence somebody has since changed into a
person's mouth. The words beside it are a record of what a person said, never a right the platform established — that
is `RIGHTS_GAP`, under `R-GAP-000`, because **no rulebook entry says what evidence a brand must keep for a picture it
prints**. The panel also says what it does not do: placing an upload on an artboard is the Elements panel's work (L4),
so it offers no button that would half-do it.

### 4. The Brand panel applies a palette in one click, and offers no font it may not set

Every row is built by Y6's own `brandTabColours` and `brandTabFonts`, the pair that already feed the shared Brand tab,
so the sublimation estimate and every licence note are worked out in one place and this panel states no print fact of
its own. A palette is applied through `setProjectColours`, which is a request the shell checks, saves and redraws, so
the panel cannot put the project into a state a person could not have reached by hand.

**Only the two bundled Geist faces have a licence on file** (decision 0079, where the database itself holds
`check (selectable = (licence = 'bundled'))`). A type style the brand holds no licence for is shown with its own
licence note and is not offered, and the panel says that setting type in any of them is the Text panel's work rather
than giving a button that would do nothing. `FONT_LICENCE_GAP` carries `R-GAP-000`, as L7's own font gap does.

### 5. Likes keeps its placeholder, because nothing in the platform records a like

Grepped for before anything was written. The spec's own data model (`docs/spec/03-data-model.md` and
`docs/spec/schemas/schema.sql`) puts `likes` on a `template` row as a **count**, not as a record of who liked what, and
**no migration in this repository has either**: there is no `likes` column on `public.templates`, no join table, and no
favourite, bookmark or shortlist anywhere. The nearest thing that exists is a design's moodboard (F-S1, decision
0082), which holds references to other people's pictures against one design and is not a like on a template.

So the panel keeps L1's labelled placeholder, and the placeholder's note is rewritten to say that plainly — it still
names L8, which it should, because L8 built the library this panel would list. An empty grid with a heart on it would
have been a feature that looks real and is not one, and inventing a `template_likes` table to fill it would have been
a feature nobody asked for. This is owner question 1.

### 6. L7's import screen: one component, one route, and one honest limit

`app/(app)/brand-studio/import/page.tsx` and `components/brand-studio/ImportPanel.tsx` render decision 0102 item 10
and decide nothing: every line comes from `importView`, `errorView`, `emptyView` or `completionView`. All six stages
are drawn from the start with the state said in **words** rather than a colour, in a live region; every row has its own
Keep and Leave out; a group that found nothing shows the view model's own empty state, which always names one action;
the rights box is labelled and starts unticked, and only `tickRights` changes it; and the completion % is shown with
what is still missing and whose weighting it is.

**One action per run, and no run row.** Owner question 2 of decision 0102 asked whether an import should survive a
reload. This takes the second of its two options — one action for the whole run — because the alternative needs a
table, row level security, `SECURITY DEFINER` functions and grants, and because the engine already reports its six
stages into the proposal it returns, so the screen has every stage's real outcome the moment the run ends. What that
costs is said on the screen: navigating away loses the proposal. **No table, so no migration and no timestamp to
claim.**

**The save goes through Y6's own schemas and Y6's own service**, so an imported brand and a typed brand are the same
brand afterwards: `profileSchema`, `paletteSchema` and `fontsSchema` re-check the three texts, the colours and the
fonts on the way in, and a font whose licence is not on file is dropped before `saveFonts` ever sees it.

**A picture is not stored by this screen, and it says so.** `uploadsFor` needs a proposal the server can trust, and
without a run row the proposal has been to the browser and back; keeping a picture would mean fetching bytes from an
address a browser chose and storing them as the brand's own. The three texts, the colours and the fonts carry no
address and are bounded by schemas that already exist, so applying them adds no trust surface at all. The pictures are
listed so a person can see what was found, the rights row renders exactly as item 10 asks, and
`PICTURES_NOT_SAVED_YET` says what is missing and what to do instead. That is owner question 3.

### 7. `pictureDetail` moved, so the view model L7 wrote for a browser can really be loaded by one

`view.ts` says "no zod and no `sharp` here, so a client component may import it". It was true of the file and not of
its imports: `view.ts -> decisions.ts -> items.ts -> pictures.ts -> sharp`, because `items.ts` took one pure
formatting function from the file that reads bytes. `pictureDetail` now lives in `items.ts` and `pictures.ts`
re-exports it, so nothing that already asked for it there has changed and the chain is broken. It was the only client
component in the repository that reached `sharp`, and it would have put a native module in the browser bundle.

The screen also imports each module by name rather than the directory's barrel: the barrel reaches `runImport`, and
from there zod.

### 8. The two actions sit outside `lib/brand-studio/import/**`, on purpose

`persistence.test.ts` walks that directory and proves no file in it imports a database client, a storage writer or a
server action — the test the spec's "nothing of a third party is stored" rule rests on. Wiring the run from inside
would have broken that proof, so `lib/brand-studio/import-screen/actions.ts` holds both actions. The style writer is
the deterministic stub with no model key and the configured model otherwise, metered against the person and the brand
who asked and refunded when the call fails: exactly `lib/benchmarks/server.ts`'s arrangement, so the browser tests
(`AI_PROVIDER_STUB=on`) never reach a vendor.

### 9. The contrast facts already measured are not re-broken

Secondary text in the launch chrome is `text-ink-2`, because `text-chalk-muted` on `glass` fails AA. An inline link is
`text-ink` and underlined, because `text-cobalt-soft` is 3.92:1 over the aurora and `.soft-link`'s own `opacity: 0.9`
is what pushes it under. Every control is at least 40 px tall, except the filter chips at 36 px, which are still well
over the 24 px minimum. Those three rules are in `components/launch/panels/frame.tsx` rather than in each panel.

## Evidence

| Claim | Test |
|---|---|
| Each panel is a default export taking exactly `LaunchPanelProps`, and asks the shell for nothing on first render | `components/launch/panels/panels.test.ts` |
| The registry fills these three and answers null for every other panel, Likes included | same |
| Every panel has a real empty state naming one action, a loading line and an error saying what to do | same, and `lib/launch-panels/view.test.ts` |
| The templates read asks for the kinds a card can be drawn from, and no others | `lib/launch-panels/templates.test.ts` |
| The search and the five filters are L8's own, and a chip that could only show nothing is left out | same |
| A card says what its garment has no data for, with that article's own rule id | same, and `panels.test.ts` |
| A row whose tag column holds a value the vocabulary does not keeps the row rather than blanking the panel | same |
| An upload shows the day, the version and the words that were on screen; an unheld version shows none | `lib/launch-panels/uploads.test.ts` |
| A brand's palettes carry Y6's own estimate, and a font with no licence on file is not offered | `lib/launch-panels/brand.test.ts`, `panels.test.ts` |
| All six import stages are drawn from the start, each with its state in words, in a live region | `components/brand-studio/import-screen.test.ts` |
| Every import row has its own Keep and Leave out, and Keep all goes once nothing is waiting | same |
| The rights box starts unticked, and a kept picture asks for the tick | same |
| A site that cannot be read says why and what to do, and offers Try again only where it may help | same |
| What the screen asks to be saved is nothing until a row is kept, and then only hexes and licensed font keys | same |
| Templates, Uploads and Brand on a real page, with their own content and no placeholder | `apps/web/e2e/launch-panels.spec.ts` |
| Likes still holds its placeholder and says why; L3's AI image panel still names L3 | same |
| axe over each new panel and over the import screen, at a desktop width and at 390 x 844, no sideways scroll | same |
| The import screen's empty state, its refusals and its completion % on a real page | same |
| No client component reaches zod, `three`, a PDF library — or, now, `sharp` | `tests/architecture/client-weight.test.ts` |

Coverage on `lib/launch-panels/**`: 100% of statements, lines and functions and 91.66% of branches, against the 90%
the plan asks for. `lib/brand-studio/**` is unchanged at 100/100/100 and 97.96% of branches. `lib/launch-panels` is
added to `apps/web/vitest.config.mts` in its sorted place and nothing else in that file is touched.

**Not measured:** a real import against a real site. Every test runs against L7's local fixtures, as the plan
requires, so what a minute of a real site costs still needs a deployment — unchanged from decision 0102.

## Not done, and why

- **No Likes panel.** Point 5. Nothing records a like.
- **No picture upload from the import screen.** Point 6. It needs a proposal the server can trust.
- **L3's two panels are not mounted.** `feat/v5-l3-ai-scenes` had not merged when this was written, so `ai-image` and
  `board-ai-image` keep their placeholders and the browser test asserts that they still name L3. Mounting them is two
  lines when it lands.
- **No panel for the library's other six kinds of template.** A marketing template, a mockup scene and a flow each
  already have their own picker, owned by L4, L2 and L6. Listing them again in the rail would be two places that can
  disagree about what a template is.
- **No `components/templates/**` filter panel for the library page itself.** L8's owner question 1 covers widening the
  `sport` column and that panel together; this work gives the five tags a screen inside the launch rail, which is what
  was missing entirely.
- **Nothing added to `lib/settings/registry.ts`.** The `brand_import.*` keys still have no console row (owner question
  6 of decision 0102 is unchanged).

## Gaps in the rulebook (`R-GAP-000`)

1. **What evidence a brand must keep for a picture it prints.** A `user_artworks` row records what a person said and
   when. No entry anywhere says what makes that enough, so the Uploads panel calls it a record and not a clearance.
2. **Which fonts the platform may use for a brand, and on a garment.** Opened by Y6 (decision 0079) and reused here
   rather than renamed; the Brand panel shows each row's licence note and offers no row whose licence is not on file.
3. **How a brand proves a pasted address is its own.** L7's own gap (decision 0102, question 7), and the reason a
   picture read from that address is not stored from this screen.

## Owner questions

1. **Should a like exist at all?** The rail has a Likes icon and the spec's data model has a `likes` count on a
   template row. A real Likes panel needs a record of who liked what — a table, its row level security and a write
   path — and that is a feature, not a panel. Until then the panel says there is nothing to list. (Blocking for that
   icon to do anything.)
2. **Should an import survive a reload?** Unchanged from decision 0102's question 2, and now the thing standing
   between this screen and keeping a picture. A `brand_import_runs` table would fix both at once.
3. **Is it right that the import screen saves the texts, the colours and the fonts but not the pictures?** The
   alternative today is fetching bytes from an address that came back through a browser. With question 2 answered it
   becomes safe.
4. **Should starting a design from a template in the launch rail open the editor?** It is the only honest action
   available — a launch canvas launches a design that already exists — but it does take a person off the canvas. The
   alternative is a Design board that offers a template when the project has no design yet, which is L1's file.
5. **Should the rail's Templates panel offer the kit bundles?** `template_kit_bundles` holds `07`'s fifteen and has no
   browser surface at all (L8's own "not done"). Crest-to-kit (F-T2) is the screen the spec gives them, and Z6 is
   building it, so they are left out here rather than given a second home.
6. **Is "You said you own this or may use it on garments" the right way to show a rights record?** It is a plain
   reading of what the row holds. A lawyer has not seen it, and gap 1 above is the reason it cannot say more.

## Dependencies

No dependency is added. Nothing was added to any `package.json`, so there is no licence line to write. No migration,
no new table, no new Postgres function and nothing to revoke. `supabase/config.toml` is untouched, and nothing here
reads or writes a Store concept.
