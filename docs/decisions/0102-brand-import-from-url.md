# 0102: Brand import from a URL — read it, derive it, keep nothing

Status: Proposed. Every number in it (the fetch allowances, the timeouts, the picture counts, the colour-folding
allowance) is a Knitwright draft chosen to be polite and cheap rather than tuned, and not reviewed by a lawyer. Owner
questions below.
Index: Proposed; nothing third-party is stored and a test proves it, only the bundled Geist faces can be matched, the screen is not wired because L7 owns no component path, four R-GAP-000 rules, owner questions listed
Index title: Brand import from a URL
Date: 2026-11-02
Plan step: `plans/platform-v5.md`, wave 4, workstream L7. Spec: `docs/spec/02-features.md` F-S9 "Import your brand"
(phase 3 of the Brand Studio), with the storage rule of F-S1 and F-S2 and spec decisions 11 ("every rule explains
itself") and 13 ("AI never draws the garment"). Builds on decisions 0079 (Brand Studio, typed by hand), 0084
(benchmarks, whose fetch discipline this follows), 0036 (the brand's own uploads and the rights tick), 0056 (platform
settings) and 0012 (metering). Owner decision 15 binds the colour numbers.

## Context

F-S9 says a brand pastes "a website or Instagram URL" and that in about a minute Knitwright imports its logos
(including the favicon), its colour palettes, its fonts as the closest licensed match, its graphics as product photos,
and a written visual style from five or more reference images — and that a completion % says how far the brand record
has got. Y6 built the whole of Brand Studio by hand (decision 0079); this adds the one path into it that reads
somebody's web page.

It is also the workstream in this plan most able to do legal damage, and three rules decided its shape before any code
was written.

1. **No third-party HTML or image may ever be stored.** This is the spec's own rule for F-S1 and F-S2, repeated in the
   plan. The single exception F-S9 allows is a product photo of the brand's **own**, stored as their own upload and only
   behind an explicit rights tick recorded with the file.
2. **It must be the brand's own site**, not a general web scraper. Z3 already built the polite fetch the plan points
   at: server-side only, one page at a time, rate-limited per brand, robots.txt honoured, an identifying user agent, a
   ten-second timeout, a bounded response.
3. **Fonts must be licensed.** Y6's own work records that only the two bundled Geist faces have a licence on file, and
   that kit font licences are an open owner question. "Closest licensed match" therefore has to mean "closest of the
   fonts Knitwright may actually use", and has to say so.

## Decision

### 1. The engine owns `lib/brand-studio/import/**`, and **no table and no migration**

An imported palette is a `brand_palettes` row like any other; an imported font is a `brand_fonts` row; the three
visual-style texts are three columns of `brand_profiles` a person could have typed; an accepted picture becomes one of
the brand's own uploads and then a `brand_assets` row. So an imported brand and a typed brand are the same brand
afterwards, and nothing in the database records that a machine filled it in. `apply.ts` builds the bodies that
`lib/brand-studio/service.ts` already saves, and saves nothing itself.

### 2. Nothing in the directory can write, and no shape it returns can carry a page or a picture

`persistence.test.ts` is the test the spec rule rests on, and it proves four things:

- **no path to a write.** No file in the directory imports a Supabase client, `lib/storage/store.ts`, a wrapper
  (`defineRoute`/`defineAction`), an actions module or Brand Studio's own service; and no file calls `.insert`,
  `.update`, `.upsert`, `.delete` or `.rpc`. `runImport` takes a fetcher, a limiter, a style writer, the font rows and
  the settings — there is no client in its dependencies to write with;
- **no byte type in any shape.** `types.ts` names no `Uint8Array`, `Buffer`, `ArrayBuffer`, base64 or blob anywhere, so
  a proposal is a plain object of numbers, colours and words. Bytes are read in exactly two files (`fetch.ts` reads
  them, `pictures.ts` measures them) and dropped on the same line in both;
- **nothing of the page survives a real run.** A whole proposal from a run against local fixtures is serialised and
  searched: no tag, no HTML entity, no `data:` URL, no base64 run of 64 characters or more, and not one sentence of the
  fixture page's body text. Every address in it starts with the fixture site's own origin;
- **nothing is uploaded without the tick.** An import with every item accepted produces a plan whose `uploads` is
  **empty** while the rights box is unticked, and whose profile, palette and fonts hold exactly one address — the
  brand's own site, as its `website`, which is `imported_from_url` of the data model.

`discover.ts` is the only file that ever sees markup, and it is a pure function: markup in, addresses, `#rrggbb` and
family names out. `fetch.ts` reads the page's text, calls `wordsOfPage` and `linksOfPage` on it, and the markup goes out
of scope on that line.

### 3. The rights tick, and only the rights tick, lets a picture be kept

A proposal is born `rights: { ticked: false }` and only `tickRights` changes it. `uploadsFor` returns **nothing at all**
while it is false — not fewer uploads, none — and when it is true every upload intent carries who ticked, when, and the
version of the words they saw. The words are `LOGO_RIGHTS` of `lib/consent/wording.ts`, the same sentence as every other
artwork upload ("I own this logo or have permission to use it on garments"), and the record is the `LogoRights` shape
`lib/storage/rights.ts` already writes with a file. An intent carries an address, a kind, a name, a type and the tick —
never bytes: the picture is fetched once more at upload time and handed straight to the storage layer, so nothing is
held between the run and the person's decision.

### 4. Z3's fetch discipline, reused rather than rewritten

`fetch.ts` imports the pieces of `lib/benchmarks` that can be shared — `normaliseUrl`, `wordsOfPage` and `robotsAllows`,
which already takes the agent name as an argument — rather than copying them. Four things differ, deliberately:

| | Z3 (benchmarks) | L7 (brand import) |
|---|---|---|
| Scheme | https or http (a product page may be old) | **https only**, as the plan's L7 section says |
| User agent | `KnitwrightBenchmark/1.0` | `KnitwrightBrandImport/1.0 (+https://knitwright.com/bot)` |
| robots.txt group | `knitwrightbenchmark` | `knitwrightbrandimport`, so a site can allow one and refuse the other |
| Requests | robots.txt and one page | robots.txt, one page, and then that page's **own** pictures |

Everything else is Z3's: logged out, no cookies, no cache, redirects followed but nothing crawled, a ten-second
timeout, a bounded response, private and link-local addresses refused, and a robots.txt we cannot read at all treated
as a refusal because a polite fetcher does not guess. A candidate address must be on the page's own registrable domain
or a subdomain of it; the one allowance is Instagram's own content network (`cdninstagram.com`, `fbcdn.net`), because
F-S9 names Instagram and its pictures are not served from `instagram.com`. That allowance is a labelled draft and an
owner question.

**One duplication is left on purpose and is recorded here:** the list of private hostnames is a copy of the one in
`lib/benchmarks/fetch.ts`, which does not export it. L7 does not own `lib/benchmarks`, so it could not be exported; when
either directory is next opened the two should become one exported constant.

### 5. Six stages, reported, inside a minute

`runImport` runs `page → logos → colours → fonts → graphics → style`, in F-S9's own order, and reports each stage
before and after it runs. Only the first can fail the import: once a page has been read, a later stage is allowed to
come back **empty** with a sentence saying what is missing and what to do instead, and the person still gets what was
found. A stage that would start after the budget has gone is marked `skipped` with "The minute was up", never left
spinning. Pictures are read one at a time, in the order the page offered them, up to the allowance.

### 6. No colour value is invented

Every `#rrggbb` an import proposes is one the page itself stated — in its own styles, its `theme-color`, or a picture of
the brand's own read by `lib/colour/palette.ts`'s k-means in CIE Lab, the same function Brand Studio's crest palette and
crest-to-kit already use. The only arithmetic applied is `lib/colour`'s, in the platform's published sRGB / D65 /
2 degree convention (owner decision 15), because no print house has stated its own white point or observer to us. Two
colours closer than ΔE 4 (CIE76, a labelled draft) are one colour. The sublimation answer is
`nearestSublimationSafe`'s, word for word, so this workstream states nothing of its own about any press; the warning
carries `R-GAP-000` and says it is Knitwright's own estimate with no ICC profile behind it.

**No Pantone code is ever worked out.** No Pantone data ships (open item P6), so `pantoneTcx` is `null` on every
imported colour and every colour carries a note, under `R-SUB-005`, that a factory has nothing to match to yet. A
colour read as pure RGB black carries `R-SUB-008`'s own advice about the factory's black recipe.

### 7. "Closest licensed match" means closest of the fonts Knitwright may use, and says so

No font file is ever fetched, embedded or committed. An import reads the **names** of the families a page asks for — out
of its own `font-family` rules and the address of any web-font stylesheet it loads — and matches those names against
the rows of `brand_studio_fonts`, where decision 0079 put the licence rule in the database itself
(`check (selectable = (licence = 'bundled'))`). A family's kind of face (mono, stencil, condensed, display, serif, sans)
is read from the words in its name, which is Knitwright's own reading and is labelled as a draft; the kind of each
**row** is read the same way, so the mapping is data, not a table in the code.

Today the list holds two selectable rows, so the honest answer is almost always "Geist Sans is the nearest font
Knitwright may use. It is not Bebas Neue, and it will not look the same", with the licence note beside it, and that is
what every row says. **Name & number is never guessed from a web page at all**: F-S9 takes it from the kit-font list, no
row of that list has a licence on file, and a page could not tell us anyway — so the row says exactly that, under
`R-GAP-000`, with `R-SUB-007`'s minimum-line rule beside it.

### 8. The visual style is words, written by an interface with a deterministic stub

`VisualStyleWriter` returns exactly three strings. There is no field a picture could arrive in, and the parser — not the
model — decides what a style may say: anything else in the reply is thrown away, each text is trimmed of control
characters and cut to the 1,000 characters the database holds, and a reply in any other shape yields three empty texts.
The stub is deterministic and never reaches the network; the real adapter goes through `lib/providers/text-model.ts` and
its existing key, adds no vendor, and is metered exactly as `lib/benchmarks/metered.ts` does it — reserved before the
call against the person and brand who asked, refunded when the call fails.

**Fewer than five of the brand's own pictures writes nothing.** F-S9 says "5+ reference images", so the stage comes back
empty with "4 of your own pictures were read, and 5 are needed", and the brand writes the three texts by hand, which Y6
already offers.

`never-draws.test.ts` proves spec decision 13 where this code could break it: the answer is three strings; a picture, a
layer or a print file a model tried to return is dropped; the instructions forbid describing the garment at all; nothing
in the directory imports `lib/panel-layers`, `lib/print`, `lib/flat`, `lib/garment`, `lib/kpp`, `lib/design-object`,
`lib/repeat`, `lib/media`, `lib/mockups`, `lib/shoots` or `lib/files-service`; and an accepted picture becomes a brand
upload of kind `logo` or `graphic` and nothing else.

**One honest limitation.** `ModelRequest` takes **one** `image` per call, so the real adapter sends the facts of every
picture as words and the first picture as the one image the interface allows. A true five-picture reading needs
`lib/providers/text-model.ts` to take an array, which L7 does not own. Owner question 5.

### 9. Data, not constants

Every allowance, timeout, picture count and colour-folding figure has a key under `brand_import.*`, a zod schema and a
labelled Knitwright default, in `settings.ts`. A platform row wins; a row that no longer passes its schema is ignored
and the default is used, as `lib/settings/resolve.ts` does for the settings the console already shows. The per-brand
counts (`brand-import-run`, `brand-import-host`) are built from those numbers rather than written as literals, exactly
as Z3 does it, and `LIMITS.brandImport` in `lib/server/limits.ts` is the per-person and per-address count an action will
name. The licensed font list is already a table. The completion-percentage weights are Y6's, in
`lib/brand-studio/completion.ts`, and are reused rather than copied: `completionView` shows the number **and what is
missing**, one line per step, because a number on its own tells a brand nothing about what to do next.

The keys are not in `lib/settings/registry.ts` yet, because that file belongs to no workstream in this wave. Owner
question 6.

### 10. The screen is a view model, and the component is not L7's to write

`view.ts` holds everything the import panel shows, worked out on the server, so the component that renders it decides
nothing: six stage lines each with a label, a line of words for whatever state it is in, and a state said in **words**
rather than a colour; a progress line that reads "Stage 3 of 6 · Reading your colours"; a group per kind with a heading,
a count, a row per item with its own two buttons ("Keep" / "Leave out"), and a real empty state naming the one action
that fills it; the rights row, unticked, with the reason nothing will be uploaded; and the completion % with its
missing steps and the line that says whose weighting it is.

**L7's section of the plan owns `lib/brand-studio/import/**` and no component or route**, so this pull request wires no
screen. What a renderer must do is written down here rather than guessed at later: secondary text in this chrome is
`text-ink-2` (`text-chalk-muted` on `glass` fails axe AA); an inline link uses `text-ink` and is underlined
(`text-cobalt-soft` is not AA over the aurora); the panel follows the phone layout pattern the app already uses rather
than a new one; the rights tick is a labelled checkbox that is never pre-ticked; and the stage list is a live region so
a minute of work is announced rather than only animated. That is owner question 1, and the first thing to pick up.

## Evidence

- `lib/brand-studio/import/persistence.test.ts` — the storage rule, four ways (see 2 above).
- `lib/brand-studio/import/never-draws.test.ts` — spec decision 13, four ways (see 8 above).
- `lib/brand-studio/import/fetch.test.ts` — two requests and no crawl; the user agent sent on both; robots.txt honoured
  for our own group and for `*`; an unreadable robots.txt refused; http, private hosts, a PDF, an over-long page and a
  font type all refused; our own timeout reported as "too slow" and a network fault as "unreachable".
- `lib/brand-studio/import/run.test.ts` — the five outputs of F-S9 from one page; every item pending; all six stages
  reported before and after; the allowance counted per brand and per site **before** the first request; a budget that
  has gone marked skipped; one page read once.
- `lib/brand-studio/import/fonts.test.ts` — only a row whose licence is on file is ever offered, and the message names
  the brand's font and says the match is not it.
- `lib/brand-studio/import/palette.test.ts` — no Pantone code worked out; the gamut warning carries `R-GAP-000` and the
  word "estimate"; `R-SUB-008` on pure black.
- Coverage on `lib/brand-studio/**`: 100% of statements, lines and functions and 97.96% of branches, against the 90%
  the plan asks for. Three unreachable nullish fallbacks on mandatory regular-expression groups were removed rather
  than left as branches no test could reach.
- `lib/brand-studio/wording.test.ts` (Y6's) scans this directory too, so no sentence here can make the gamut estimate,
  a Pantone code or a font licence sound settled.
- **Not measured:** the one-minute budget against a real site. Every test runs against local fixtures, as the plan
  requires, and `fakeFetcher` throws on any address it was not given, so a test that would reach the network fails
  instead of making a request. What a real site costs needs a deployment.

## Alternatives

- **Store the page and the pictures, then derive from them later.** Refused: it is the one thing the spec forbids, and
  it would make Knitwright the holder of other people's HTML and photographs for no gain. Deriving on the spot costs one
  re-fetch of a picture the person chose to keep, and nothing else.
- **Write a second fetcher.** Refused: Z3's is already polite, already tested and already reviewed. Importing
  `normaliseUrl`, `wordsOfPage` and `robotsAllows` keeps one robots.txt parser in the codebase. The cost is that https
  and the user agent had to be layered on top rather than configured, and that the private-host list is duplicated
  (recorded in 4 above).
- **A general scraper with a crawl of two or three pages.** Refused: F-S9 says "your website or Instagram URL", and one
  page of a brand's own site is a different thing in kind from a crawl. One page, its robots.txt and its own pictures.
- **Map a brand's font by downloading the web font and comparing outlines.** Refused outright: it would mean fetching
  and storing a third party's font file. Names are compared, and the answer says plainly that it is not the same font.
- **A `brand_import_runs` table, so a run survives a reload and the stages can be polled.** Not taken in this pull
  request: it is the right shape for a minute-long job, but it needs a table, row level security, SECURITY DEFINER
  functions and grants, and the screen it would serve is not L7's to write. The engine reports its stages through
  `onStage` so either wiring — a run row polled, or one action per stage — can use it unchanged. Owner question 2.
- **Let the import save straight into the brand.** Refused: an import a person never looked at would then change their
  brand. Every row starts pending and the rights tick starts false.

## Consequences

- Brand Studio gains the import path of F-S9 as a tested engine with a view model, and Y6's hand-typed Brand Studio is
  unchanged: the same tables, the same functions, the same completion %.
- **The screen is not wired.** Nothing in the app calls `runImport` yet, because L7 owns no component or route. The
  first follow-up is a panel on `/brand-studio` and one action per stage (or a run row), and the view model and the
  stage reports exist for exactly that.
- A brand importing its site today will almost always be told that the nearest font Knitwright may use is not its font.
  That is the honest state of the licence list, not a limitation of the matcher, and it changes the day a font licence
  is bought.
- Every imported colour arrives with no name and no Pantone code, because the page gave neither. A person names them.
- An import makes one paid call at most, and only when five or more of the brand's own pictures were read.
- What would make us revisit this: a font licence (7), an array of pictures in the provider interface (8), or an owner
  decision that a brand may import from a site that is not its own (which would change the whole shape of 4).

## Owner questions

1. **Who wires the screen?** The engine and its view model are done; the panel, the route and the stage-by-stage
   progress need a component path. L7's section grants none. (Blocking for the feature to be usable at all.)
2. **Should a run survive a reload?** A minute-long import loses its proposal if the person navigates away. A
   `brand_import_runs` table would fix that and would also let the stages be polled rather than streamed. Worth the
   table, or is one action per stage enough?
3. **Are the fetch allowances right?** Six imports per brand per hour, forty requests to one site per hour, sixteen
   pictures per import, ten seconds per request, a minute in all. Every one is a Knitwright draft, chosen to be polite.
4. **Is the Instagram content-network allowance acceptable?** `cdninstagram.com` and `fbcdn.net` are treated as serving
   the brand's own pictures when the pasted address is on `instagram.com`. Without it, an Instagram import finds no
   pictures at all. With it, we fetch from a host the brand does not own.
5. **May `lib/providers/text-model.ts` take several pictures per call?** F-S9 asks for a style written from five or
   more images; the interface takes one, so today the model sees one picture and the facts of the rest in words.
6. **Should the `brand_import.*` settings appear in the platform console?** They have keys, schemas and defaults, but
   `lib/settings/registry.ts` belongs to no workstream in this wave, so no admin can change them yet.
7. **Does a brand need to prove the site is its own?** Today the only check is that every picture is on the pasted
   page's own domain. Nothing stops a brand pasting somebody else's site; nothing of it would be stored, but its
   colours and its fonts' names would be read. A verification (a DNS record, a file at a known path, an email on the
   domain) is the honest answer, and it is a product decision. This is one of the four `R-GAP-000`s.
8. **Is "I own this logo or have permission to use it on garments" the right sentence for a product photo?** It is the
   wording already on file and already versioned, and a photograph is not a logo. A new version would need a migration.

## Rule gaps (`R-GAP-000`)

1. **Printable gamut** — which colours a sublimation press can reach. Opened by Y6 (decision 0079 item 7) and reused
   here rather than renamed; the rulebook's `R-SUB-005` is about comparing a colour with a printed strike-off, which is
   a different claim.
2. **Font licence** — which fonts the platform may use for a brand, and on a garment. The rulebook says nothing, and
   `brand_studio_fonts` holds the answer as data.
3. **Own site** — how we know a pasted address belongs to the brand that pasted it (owner question 7).
4. **Written style** — how a visual style may be written from a brand's own pictures, and what it may say.

## Dependencies

No dependency is added. Everything used is already in the repository: `sharp` (Apache-2.0, already used by
`lib/brand-studio/crest.ts` and the storage layer) to measure a picture and read its pixels, and `zod` (MIT, already
used everywhere) for the settings schemas. No font, no HTML parser, no colour library and no vendor SDK was added.
