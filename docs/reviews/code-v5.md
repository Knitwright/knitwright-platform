# Code review of plan v5 (R2)

Scope: platform code in `apps/web` (`app`, `lib`, `components`, `tests/architecture`), the v5 migrations
(`supabase/migrations/202611*`, `202612*`) and the thirty v5 decision records (0066 to 0108). Not reviewed: Store/Sell code,
`Sportswear/`, `kitwright/`, `supabase/config.toml`. Security has its own review (R1); where a finding here is a security
finding it says so and is left to that review.

Method: a TypeScript AST scan for file length, function length and nesting; a scan of every `R-<TOPIC>-<NNN>` literal in
non-test source against the rule ids every `docs/spec/articles/*/rulebook.md` publishes; a replay of
`lib/techpack/wording.test.ts`'s own scan against the folders it does not read; five directed duplicate hunts (colour and
ΔE, tokens and hashing, polite fetching, rate limiting, credits, PDF typesetting, template rows, money and tax); a sweep of
every decision record's "left for", "not done" and "owner question" sections cross-checked against the code; and a column-by-
column check of the v5 migrations for a declared column nothing writes. No database was started: every claim about the
database is read from the migration text, and no test added here writes a row.

Baseline on `main` (`08a18ea2`): `typecheck`, `lint`, `tests/architecture` and the wording test all pass.

The review was written while `fix/v5-wave4-wiring` (#140) was still open. Every "unmounted panel" row below is stated as of
`main`; #140 mounts some of them and says which.

## Summary

| Check | Result |
|---|---|
| Files over 400 lines (plan rule) | **none** — largest source file is 356 lines (`lib/techpack/types.ts`). Now held by a test (`tests/architecture/file-length.test.ts`) |
| Functions over 50 lines (plan rule) | 193 in total. **4 are non-fixture `lib` functions**; 14 are fixtures or test doubles; the remaining 175 are React components, hooks and page functions |
| Nesting over 4 levels | 14, all in flood fills, XML and DXF readers |
| `console.log` / `console.debug` in app code | none |
| Empty `catch {}` in app code | none |
| Migration timestamp collisions | none |
| Rule ids that resolve to nothing | **none in production source.** Every `R-<TOPIC>-<NNN>` outside tests is either in a published rulebook or is `R-GAP-000`. Two exceptions, both deliberate: `R-SUB-009` as a format example in the admin rule editor's hint, and `R-TOPIC-001` in a doc comment |
| `R-GAP-000` | 588 textual occurrences, **102 distinct subjects in 14 groups**, 29 of them opened by two or more workstreams |
| Invented values | no currency conversion anywhere; three modules actively refuse to convert. One schema that cannot say "no tolerance agreed" (H3) and three unsourced tolerances that decide something (M6) |
| Duplicate implementations of one rule | **21 groups.** Two carry a behavioural divergence that is a defect, not a style difference (H1, H2) |
| Outstanding unwired seams | **96**, in five kinds. Twenty-two are a built component that nothing mounts |
| Wording guard | satisfied by accident in two ways; both fixed (see "Wording") |

**HIGH findings: 4.** Three are deferred with an owner question because each changes another workstream's design; one was
fixed. Everything fixed in this PR is listed under "Fixed here".

---

## HIGH

| # | Where | Finding | Status |
|---|---|---|---|
| H1 | `supabase/migrations/20261025060000_credits.sql:227` vs `20261201030000_flow_runs.sql:694` | **Two spend functions over one ledger disagree about who may spend a brand's credits.** `public.credit_spend` requires only `private.belongs_to(p_user_id, p_brand_id)`; `public.credit_spend_output` requires `private.can_manage_kit`. The second carries a comment naming the discrepancy by name: *"`credit_spend` asks only for membership; a viewer should not be able to spend."* The weaker check is on the main spend path. The two bodies are otherwise ~90% the same text (same `credit_lock`, same `credit_balance`, same four returns), differing in the idempotency key (`spend:kind:hash` vs `spend-output:kind:md5(len:hash:output_key)`), in quantity support (`p_units` 1–64) and in refund scope (every un-refunded spend on a version hash vs one entry by id). **Recommendation: `credit_spend_output` wins** — a stronger authorisation check, a key that is length-prefixed, a truncated note and a quantity — with `credit_spend` reduced to a `units = 1` wrapper over it, which closes the viewer gap in one place. **Deferred**: it is a migration against another workstream's table and a privilege change. Owner question: should a viewer be able to spend a brand's credits? **Also referred to R1.** | open |
| H2 | `apps/web/lib/crest-to-kit/decode.ts:16-18,32` vs `apps/web/lib/brand-studio/crest.ts:41` and `apps/web/lib/brand-studio/import/pictures.ts:33` | **A comment asserts two crest decoders agree, and they do not.** `crestPixels` passes `{ density: 150 }` to `sharp`; both Brand Studio decoders pass nothing, so `sharp` rasterises at its default 72 DPI. For an SVG or PDF crest the two paths therefore read different pixel grids and can return different palettes — while `decode.ts`'s own header says *"at the same width, so a crest read here and a crest read there give the same colours"*, and `crest.ts` says the same from its side. Three separate private `READ_WIDTH = 256` constants, each commented as matching the others. **Recommendation: one `pixelsFromBytes` in `lib/colour`, modelled on `crest-to-kit/decode.ts`** (it is the only one that sets `density` and the only one that returns a typed outcome rather than throwing), with the width as its one constant. **Deferred**: unifying them changes which palette Brand Studio shows for a vector upload, which is Y6's and L7's design. Owner question: should a vector crest be read at 150 DPI everywhere? | open |
| H3 | `supabase/migrations/20261101010000_base_articles.sql:66-69`, seed `:227-239`; `apps/web/lib/kpp/files/tables.ts:8-9` | **`article_poms` cannot say "no tolerance agreed", and its rows carry no provenance.** `grade_mm`, `tol_minus_mm` and `tol_plus_mm` are `not null` with only a `>= 0` check, and the row holds no `label`, `source`, `source_quote` or `sourced` column. Its two siblings do: `bom_consumption` has four provenance columns plus `confirmed`, and O1's `ops_aql_*` has `source` + `sourced` + `label`. Because the columns cannot be null, the gate at `apps/web/lib/kpp/gate.ts:52` — which does refuse a null tolerance — can never fire for a catalogue POM. The figures reach a production file: `tables.ts` writes them straight into the package's `pom.csv`, which has **no provenance column**, while the sibling `techpackJson` does carry `provenance` per POM. Calibration: the numbers themselves are faithfully quoted from `docs/spec/articles/JSY-SS-01/article.json` and held there by `lib/catalogue/seed/sql.test.ts`, and the article-level label *"Knitwright draft v0.1, not reviewed by a factory"* does reach the KPP README and the catalogue page. What is missing is the per-row marker and the ability to represent absence — and the plan says in terms that *"inventing a tolerance is exactly the invented measurement the rules forbid. A missing tolerance is a question for the factory."* **Recommendation: nullable tolerance columns plus `source`/`sourced`/`label`, as `bom_consumption` has, and a provenance column on `pom.csv`.** **Deferred**: a migration and a production-file format change, both X1's and X5's. | open |
| H4 | `apps/web/lib/techpack/wording.test.ts` | **The settled-words guard read one folder at a time, so every folder a workstream added below a scanned one went unread.** `lib/techpack/exports/**` (the whole 16-page PDF and the Excel writer), `lib/techpack/view/**` (the tech pack view models) and four of the five registry families — `bottoms`, `close-fitting`, `outerwear` and **`teamwear`**, the family v5 added — were outside the scan entirely. Nothing in them breaks the rule today, which is luck: the files hold sentences the scan would have stopped on, including *"What nobody has confirmed yet"* on two export pages and the Review tab's note, and `lib/techpack/view/fields.ts` renders a chip whose word is **"Confirmed"**. **Fixed here.** | fixed |

---

## 1. The same thing built twice

Twenty-one groups. Eight of them are *self-declared*: the second author left a comment saying they were copying and that the
two should become one. Those comments are the strongest evidence in this review, and they are listed first.

### Self-declared duplicates

| # | The two (or more) | What the second author wrote | Which should win, and why |
|---|---|---|---|
| D1 | `lib/benchmarks/fetch.ts:27` and `lib/brand-studio/import/fetch.ts:29` — the private-host regex, **byte-identical** | *"The same list as `lib/benchmarks/fetch.ts`, which does not export it; when either directory is next opened the two should become one exported constant."* | **Fixed here**: `lib/http/public-url.ts`, asked by both. Under `lib/http` because it belongs to no feature |
| D2 | `lib/moderation/metered.ts`, `lib/benchmarks/metered.ts`, `lib/inspiration/suggest/metered.ts`, `lib/brand-studio/import/style.ts`, `lib/crest-to-kit/rank.ts`, `lib/inspiration/sources/ai-mood.ts`, `lib/marketing/copy/metered.ts` — **seven** hand-written reserve-then-refund wrappers | *"The same shape as lib/moderation/metered.ts, so there is one way of doing this in the codebase"*; *"The same shape as `lib/benchmarks/metered.ts`"*; *"It is the shape `lib/inspiration/suggest/metered.ts` uses, deliberately."* | **`runMetered` / `RouteUsage` (`lib/server/core/metered.ts:65-99`)** — the only one that is refund-idempotent, the only one that logs a failed refund, and the only one that returns a typed failure rather than throwing a sentence. The seven all swallow a failed refund silently, and only `marketing/copy/metered.ts` refunds when a call returns "not ok" without throwing, so the other six charge for an unusable answer. `lib/files-service/metered.ts` has the complementary bug: it refunds on `!ok` and never wraps in `try`, so a throw keeps the reservation |
| D3 | `lib/share/token.ts` and `lib/job-packet/token.ts`; `private.share_token_hash` (`20261011030000_share_links.sql:92`) and `private.job_packet_hash` (`20261101060000_job_packets.sql:93`) | *"The shape is the same as a share token."* | **`lib/share/token.ts` and `private.share_token_hash`** — already the shared ones for four token families (committee links, roster sign-up, share invites all import them; `committee_signup.sql:5` documents the reuse). The SQL bodies are character-identical; `job_packet_hash` should be a wrapper or dropped |
| D4 | `lib/files-service/token.ts` and `lib/store-contract/token.ts` | *"The same idiom as the files-service token."* | **`lib/store-contract/token.ts`** — it enforces a 32-character secret floor on both sign and verify; `files-service` rejects only the empty string on sign and checks nothing on verify. Note both name their body digest `sha256` while it is an HMAC with a constant key, which `files-service/token.ts:9`'s comment states wrongly |
| D5 | `lib/intent/proposal-token.ts` and `lib/consent/unsubscribe-token.ts` | *"It follows the proposal tokens … with a key of its own."* | **`lib/intent/proposal-token.ts`** — it has expiry and audience binding. The unsubscribe token's lack of expiry is deliberate and documented; the duplication is the derive-key/HMAC/timing-safe-compare boilerplate, which with D4 makes four copies and no `lib/tokens` module |
| D6 | `lib/benchmarks/limits.ts:15-23` and `lib/brand-studio/import/settings.ts:101-107` — per-brand plus per-host rate limits | both carry near-identical justification prose (*"counted per brand, not per person, because ten people in one brand must not …"*) | **`lib/brand-studio/import/settings.ts`'s shape** — its numbers are settings with zod bounds and an admin override, which is the plan's own "Data, not constants"; benchmarks' are code constants. The key format, the brand-then-host order and the lowercasing are identical and want one `perBrandPerHost` factory |
| D7 | `lib/brand-studio/words.ts:129` (`gamutEstimate`) and `lib/brand-studio/import/words.ts:147` | L7 reused Y6's gap *by name rather than renaming it* | Nothing to merge — this is the **right** behaviour and the model for the other 28 shared gaps (see §3) |
| D8 | `20261201030000_flow_runs.sql:692` | the comment that names H1 | see H1 |

### Found by this review

| # | The two (or more) | How they differ | Which should win, and why |
|---|---|---|---|
| D9 | **sRGB→Lab**: `lib/print/rules/colour.ts:10` (`toLab`, exported), `lib/intent/eval/colours.ts:17` (private), `lib/design-import/colours.ts:26` (`rgbToLab`) | the maths is bit-identical in all three (same matrix, same D65 white, same exact-rational ε/κ). Only `print/rules` validates its input; `intent/eval` returns `NaN` for a malformed hex and `matchColours` then reads that as "no match" rather than an error | **`lib/print/rules/colour.ts`** — the platform convention, already imported by `guardrails/gamut`, `variants/lab`, `kpp/encode` and `colour/convert`. `intent/eval`'s copy can be deleted outright. `design-import`'s takes bytes, which the shared module does not offer: that is an API gap, so add an exported `labFromRgb` rather than keep a second transform. Note `lib/media-check` imports `Lab`/`rgbToLab` from the **duplicate** |
| D10 | **Lab→sRGB**: `lib/colour/convert.ts:35`, `lib/design-import/colours.ts:35`, `lib/variants/lab.ts:17` | same inverse matrix and encode function, three different clamp orders. They agree for every input today, but only because the transfer function is monotonic through both branches — which no one file shows | **`lib/colour/convert.ts:labToHex`**, the only one whose doc comment states the convention and the clipping caveat, plus a new exported `linearRgbFromLab` so `variants/lab.ts` keeps its gamut-walk policy (a 24-step chroma search that desaturates rather than clips — a different and legitimate policy) without re-deriving the maths |
| D11 | **CIE76 ΔE**: `lib/print/rules/colour.ts:24`, `lib/intent/eval/colours.ts:28`, `lib/design-import/colours.ts:45` | the first two are character-for-character the same body over the same Lab | **`lib/print/rules/colour.ts`**; `intent/eval`'s is a verbatim duplicate of an exported function. The *tolerances* beside them (4, 20, 12, and a per-import setting) genuinely disagree and are each documented as a product setting, which is correct |
| D12 | **LCH**: `lib/colour/convert.ts:48` (`toLch`), `lib/variants/lab.ts:9` (`lchOf`), inline in `lib/guardrails/gamut.ts:16` | one precomputes `180/π` and the others divide, so the three differ in the last floating-point bit | **`lib/colour/convert.ts:toLch`** — exported, re-exported by `palette.ts`. `gamut.ts` already imports from `print/rules/colour`, so it has no cycle excuse |
| D13 | **Palette extraction**: `lib/colour/palette.ts:124` (`extractPalette`, marked "SHARED, DELIBERATELY") and `lib/design-import/colours.ts:105` (`clusterColours`) | both deterministic k-means in Lab; they do not agree on any real image. Squared vs un-squared distance, k-means++ vs farthest-first, unique colours weighted by count vs raw pixels, 24 iterations with early exit vs a fixed 10, plus merge and speck passes `palette.ts` has no equivalent of | **`lib/colour/palette.ts`** as the engine, **but it cannot absorb the other yet**: `design-import` clusters "garment pixels outside the detected marks", which the shared `PaletteOptions` can only express as an alpha threshold. Add `mask?: Uint8Array` first. Until then the second copy is defensible; it should at minimum stop re-deriving Lab (D9) |
| D14 | **`sharp` decode to RGBA**: `lib/crest-to-kit/decode.ts:30`, `lib/brand-studio/crest.ts:41`, `lib/brand-studio/import/pictures.ts:33` (the last two byte-for-byte identical), plus `lib/design-import/raster.ts:18`, `lib/media-check/frame.ts:48`, `lib/artwork-intake/raster/pixels.ts:7` | the three 256-wide ones agree except for H2's `density`. The other three have genuinely different post-processing (flatten on white, box blur, colourspace coercion) | see **H2**. The three decoders used for palettes should become one; the other three stay |
| D15 | **`hexToRgb`**: `lib/design-import/match/grid.ts:38` (exported) and `lib/design-import/marks.ts:90` (private) | **character-for-character identical**, same `Rgb` type, same directory tree, and `marks.ts` already imports eight symbols from its siblings | `match/grid.ts`'s. The smallest fix in this review: delete one line and add an import. Not taken here only because it is inside another workstream's module and carries no test that distinguishes the two |
| D16 | **rgb→hex**: `lib/design-import/raster.ts:64` (the only exported one), `lib/pattern-generators/colour.ts:12`, `lib/artwork-intake/vector/colour.ts:15`, plus the three Lab encoders of D10; and three more hex *parsers* in `lib/mockups/paint.ts:26`, `lib/print/render/format.ts:28`, `lib/flat/colour.ts:31` | functionally identical for finite input | The root cause is that **`lib/colour/convert.ts` has no byte-level hex helpers at all**, so every workstream wrote its own. Move `toHex` and `hexToRgb` there |
| D17 | **HSL**: `lib/pattern-generators/colour.ts:24` (`hslOf`, exported) and `lib/templates/colour-family.ts:19` (`hsl`, private) | algebraically identical, written two ways (branching vs closed-form saturation; 0–6 hue with a wrap term vs a negative-capable modulo). `pattern-generators` silently substitutes `#9aa3ae` for a malformed hex; `templates` pre-validates and returns null | **`templates/colour-family.ts`'s body**, exported from `lib/colour`, which has no HSL support at all today. The two *consumers* (eleven prose colour words vs nine filter families, with different cut points) are legitimately different and should not be merged |
| D18 | **react-pdf document shell**: `lib/ops/factory-sheet/pdf.ts`, `lib/ops/invoice/pdf.ts`, `lib/ops/packing/pdf.ts`, `lib/orders/manifest-pdf.ts` — four near-verbatim copies of the same colours, `CREATED` line, hyphenation switch, `text`/`row`/`heading` helpers, page style and footer | three real defects fall out of it: `ATTENTION = "#9a3412"` in the three ops PDFs against `COLOURS.warn = "#9a5a08"` in the shared styles, so **two different "attention" oranges ship**; `orders/manifest-pdf.ts` has no footer and no `paddingBottom`, so a long player list has **no page numbering**; and its `title()` at line 22 does **not** pass text through `drawable()`, unlike every other string in all four files, so an uncovered character in a section title garbles the glyphs after it — which is exactly what `lib/techpack/exports/pdf-text.ts:4` warns about | **`lib/techpack/exports/pdf/styles.ts` + `parts.ts`**, with `lib/quotes/document.ts` as the reference consumer: Z6's quote PDF imports the font family, typeset, `heading`, `paragraph` and the colour set and declares **zero constants of its own**. It is the model citizen of this review. All four copies should be rewritten against it |
| D19 | **mm↔pt and A4**: `PT_PER_MM` in `lib/kpp/pdf/writer.ts:11`, `POINTS_PER_MM` in `lib/print/render/pdf/content.ts:5`, `POINTS_PER_INCH` in `lib/marketing/export/pdf.ts:20`, `MM_PER_INCH` in `lib/launch/artboard.ts:26`; `A4` in `lib/techpack/exports/pdf/styles.ts:24`, `PAGE_SIZES` in `lib/kpp/pdf/flow.ts:5`, `A4_WIDTH_POINTS` in `lib/flat/render-pdf.ts:152` | the same millimetre value serialises at 2, 4 and 6 decimal places depending on which writer touches it; `595.28` appears as a literal twice; `flat/render-pdf.ts:160` re-derives a content width `styles.ts:28` already has, with a different margin | **`lib/print/render/format.ts`** for the constant and the formatters (it is the only one that guards non-finite values and negative zero) and **`styles.ts`** for A4 and the margins |
| D20 | **text measurement**: six average-glyph-advance constants spanning **0.55 to 0.65** (`lib/kpp/pdf/canvas.ts:22`, `lib/techpack/exports/pdf/keep.ts:19-20`, `lib/flat/geometry.ts:71`, `lib/flat/review-note.ts:6` — a verbatim copy of the previous — `lib/flat/kit-pattern.ts:38`, `lib/panel-layers/to-fabric.ts:19`); and two exported `textWidthMm` whose second argument is **points in one and millimetres in the other** (`lib/kpp/pdf/canvas.ts:25`, `lib/print/text/outline.ts:86`) | the same string is measured four ways at the sizes actually used; only `print/text/outline.ts` reads real glyph advances from the bundled font | **`lib/print/text/outline.ts`** wherever accuracy matters; one shared constant for the "leave room" estimates. Five values that disagree by 18% are not a convention. The two same-named functions with different units should be renamed regardless |
| D21 | **`formatMoney` exported twice**: `lib/factory/pricing.ts:99` (`"£29.00"`, `en-GB`, hard-coded `/100`) and `lib/designers/royalty.ts:42` (`"AUD 12.50"`, currency-correct fraction digits); plus five more private money formatters in `lib/ops/format.ts:6`, `lib/ops/invoice/pdf.ts:30`, `lib/collections/entry.ts:50`, `lib/factory/view.ts:18`, `components/benchmarks/CardReview.tsx:26`; and three minor-unit *parsers* with three different grammars (`lib/factory/edit.ts:120`, `lib/collections/entry.ts:41`, `lib/benchmarks/corrections.ts:22`) | six of the seven hard-code `/100`, while four of them accept a free-text three-letter currency from a Store order row; only `lib/ops/format.ts` catches `Intl.NumberFormat` throwing on an unknown code. And `app/(ops)/ops/factories/sections.tsx:38` renders a literal **`£`** on a price-ladder value that may be AUD | **`lib/factory/pricing.ts:formatMoney`** as the one entry point — it is what nine modules already import — but it must absorb `designers/royalty.ts`'s currency-aware fraction digits and `ops/format.ts`'s `try/catch`. The `£` literal should be fixed whatever happens to the rest |
| D22 | **`formatLength` exported twice**: `lib/units/length.ts:28` takes **centimetres** and writes tape-measure eighths (`"20 1/2 in"`); `lib/techpack/view/units.ts:32` takes **millimetres** and writes two decimals | same name, same module shape, first argument differs by 10× | Rename at minimum. `techpack/view/units.ts` is richer (three units, `formatSigned`, `formatLengthWithUnit`); `units/length.ts` is the only one that writes fractions. They should become one module with an explicit input unit |
| D23 | **partial order total written twice**: `lib/quotes/quote.ts:189-209` and `lib/teamwear/pricing.ts:182-194` | the same rule including the same singular/plural trick and the same `" and "` join, with two different trailing sentences, so **the same kit reads differently in the configurator footer and on the quote PDF**. Only `quotes/quote.ts` re-derives every line through `priceDisagreement` and throws `QuoteRefused` if the sum's inputs disagree; the footer shows a total nobody verified | **`lib/factory/pricing.ts`** already owns `priceBasket` and should gain `partialTotal(lines)`; `teamwear/pricing.ts` should inherit the re-derivation check, because the footer and the quote are supposed to agree to the penny and today only one side checks |
| D24 | **`Grade` collapse rule written three times**: `lib/sizing/parse-row.ts:74`, `lib/charts/values.ts:55`, `lib/sizing/charts/starter-rows.ts:27` | the "one step means even" rule re-decided by each caller, with three different validation stances (bespoke negative message / monotonicity refusal / none) | extract the collapse into `lib/sizing/schemas.ts` beside the `Grade` type: a type's own invariant should not be re-decided by its callers |
| D25 | **`name = value` line parsing**: `lib/settings/input.ts:11` and `lib/factory/edit.ts:134-143` | `factory/edit.ts` uses `split("=")`, so **a value containing `=` is silently truncated**; `settings/input.ts` uses `indexOf` + `slice` and survives it | **`lib/settings/input.ts:splitLines`**. The two other line parsers (`lib/ops/qc/parse.ts`, `lib/clubs/signup/paste.ts`) are different formats and `paste.ts:10` says so explicitly — keep both |
| D26 | small things: `TENTHS_MM_PER_CM` redeclared in `lib/sizing/charts/starter-rows.ts:17` while `lib/sizing/cm.ts:1` imports it from `@/lib/garment`; four `ALLOWANCE_USED_UP` constants with different wording; three copies of the `(inTokens·inPrice + outTokens·outPrice)/1e6` cost formula (`lib/moderation/metered.ts:16`, `lib/inspiration/suggest/metered.ts:15`, `lib/marketing/copy/metered.ts:24`) while `lib/benchmarks/metered.ts` and `lib/design-import/cost.ts` correctly call the shared `callCost`; two canonical-JSON serialisers that produce **different bytes for the same object** (`lib/pattern-service/snapshot.ts:20` key-sorted and whitespace-free, `lib/kpp/encode.ts:32` indented with a trailing newline), so hashes are not comparable across them; the same `linkLimitKey` template written four times; `lib/shoots/run.ts:99,129` re-implementing `lib/media/video/run.ts:90,107` | | one-line consolidations each; `canonicalJson` from `pattern-service/snapshot.ts` wins the serialisation, `sha256Hex` from `kpp/encode.ts` the digest |

### Correctly single-sourced — stated because each was a hunting ground

- **Tax, VAT and GST.** `lib/markets/tax.ts:66 taxTreatment` is the only place a rate, name, registration state or threshold
  becomes anything. `lib/quotes/vat.ts:46` is a one-line delegation and says so. Z6's fold into `lib/markets/tax.ts` is clean.
- **Currency conversion.** None exists. Three modules actively refuse: `lib/store-contract/money.ts:51`,
  `lib/collections/landed.ts:60` (returns `minor: 0` plus a note when freight is in another currency), `lib/factory/pricing.ts:38`.
  `20261210030000_australia_and_translate.sql:55` puts *"Never computed from the GBP price"* in the column comment.
- **The CSV tokeniser.** `lib/sizing/csv.ts:94` is the only quote-aware scanner and has three correct callers. The three
  *template formats* above it (fixed-column size chart, synonym-mapped roster, regex-heuristic brand spreadsheet) are three
  different file formats for three different jobs, not duplicates.
- **CIEDE2000.** One implementation, correctly cited (`lib/media-check/ciede2000.ts`), two consumers.
- **Frame sampling.** One timestamp picker (`lib/media/video/shot-plan.ts:81`), one extractor
  (`components/video/sample-frames.ts:70`, deliberately import-free because a real Chromium compiles it), and
  `lib/media/video/frame-check.ts:17` documents the division of labour. No duplication.
- **The rate limiter.** One SQL function, one TS limiter, one `LIMITS` table of about sixty named rules, every route and
  action passing one. The best-factored area in the review; the duplication in D6 is in the key helpers, not the mechanism.
- **The robots.txt parser.** `lib/benchmarks/robots.ts` takes the agent name as an argument and brand-import imports it.

### Two product inconsistencies that fall out of the duplicates, for the owner

1. `lib/crest-to-kit/palette.ts` reports **CIEDE2000** and `lib/brand-studio/import/palette.ts` reports **CIE76** for what is
   conceptually the same "distance from the sublimation-safe colour", both derived from the same `nearestSublimationSafe`. Two
   screens print different numbers for the same crest colour.
2. `lib/make/order-modal.ts` uses `priceBasket`'s strict all-or-nothing total while `lib/quotes/quote.ts` and
   `lib/teamwear/pricing.ts` use a partial one (D23), so the order modal says "no total yet" for a basket the quote PDF gives
   a figure for.

---

## 2. Seams that were left unwired

Ninety-six outstanding seams. The table is the review's main product; it is grouped by what kind of thing closes each one.
Stated as of `main` at `08a18ea2`: #140 mounts part of group A.

### A. A component that is built, tested and mounted nowhere (22)

The two registries are `components/launch/RailPanels.tsx:28` and `components/launch/Inspector.tsx:21`; between them they hold
L2's three panels and the three from decision 0108. Wave 2's editor slots are `components/studio/editor/EditorShell.tsx:166,200,201`
and `components/studio/editor/CanvasFrame.tsx:56,69`, all still drawing `SlotPlaceholder`.

| # | WS | Where | What is not wired | Owner |
|---|---|---|---|---|
| A1 | L4 | `components/marketing/panels.ts:23` | `MARKETING_PANEL_COMPONENTS`, six panels, imported nowhere. Spread into both registries | orchestrator |
| A2 | L3 | `components/shoots/ShootsPanel.tsx`, `AiImageBoardPanel.tsx` | `ai-image`, `board-ai-image` draw placeholders | orchestrator |
| A3 | L5 | `components/video/AiVideoPanel.tsx` | `board-ai-video` is a placeholder | orchestrator |
| A4 | L6 | `components/flows/FlowRunPanel.tsx`, `InfoCardPanel.tsx`, `FlowCanvas.tsx` | `board-info-card`, `flow-run` and the flow canvas unmounted | orchestrator |
| A5 | L5 | `components/video/VideoStudio.tsx` | the whole video studio has no page or route | orchestrator |
| A6 | L6 | `components/flows/FlowTemplates.tsx` | templates picker built, never mounted | orchestrator |
| A7 | Y3 | `components/studio/editor/library/LibraryToolbar.tsx` | the `library` slot. `e2e/editor-library-2d.spec.ts:56` self-skips with the reason, so it starts passing the day the line lands | orchestrator |
| A8 | Y3 | `components/studio/editor/view-2d/PatternView.tsx` | the `view-2d` canvas slot | orchestrator |
| A9 | Y4 | `components/studio/editor/specs/SpecsToolbar.tsx` | the `specs` slot. Decision 0077 says there is no end-to-end test "because nothing draws these panels" | orchestrator |
| A10 | Y4 | `components/studio/editor/techpack-view/TechPackView.tsx` | the `tech-pack` canvas slot | orchestrator |
| A11 | Y5 | `components/studio/editor/export/ExportPanel.tsx` | the `export` slot, plus the Excel download address the route must supply | orchestrator |
| A12 | Y8 | `components/studio/editor/names-numbers/index.tsx`, `repeat-maker/index.tsx` | both have **no reference anywhere**, though `lib/editor/slots.ts:20` declares the slots | orchestrator |
| A13 | Z1 | `components/inspiration/InspirationPanel.tsx` | no page mounts it; Y3 leaves a labelled slot for it | orchestrator, after A7 |
| A14 | Z2 | `components/rulebook/ask/AskBox.tsx` and siblings | nothing mounts the Ask box | orchestrator, after A9/A10 |
| A15 | X2 | `components/rulebook/WhyPreview.tsx` | no member-facing page carries a `<WhyLink>`; only `/admin/rulebook` does, so the member reader has no browser test | orchestrator |
| A16 | L1 | `components/launch/useLaunchShell.ts:191` | hard-coded *"The panel that runs it is not built yet."* for a board that is ready to run; goes when A4 lands | orchestrator |
| A17 | X5 | `app/api/projects/[projectId]/production-package/route.ts` | the export route is mounted and **no page or component links to it** | orchestrator |
| A18 | Z8 | `lib/compliance/{checklist,export-gate,items,review,subject,from-package,from-order,from-techpack}.ts` | **the checklist and the pre-export gate are unwired.** Eight of the thirteen modules have no non-test importer outside `lib/compliance`, the checklist and `export-gate` among them, so the one checklist Z8 built decides nothing. The row readers, the AQL planner, `model` and `labels` **are** wired, by `lib/markets/view.ts`, `lib/ops/aql/from-plan.ts`, `lib/store-contract/sellable.ts` and `lib/techpack/labels.ts` — so this is a partly-wired directory, not an unread one. Z8 owns no route, page or component | orchestrator |
| A19 | Z8→X5 | `lib/kpp/sources/server.ts:119` | the package still passes `NOTHING_UNSOURCED` for label wording, the AQL plan, measure, visual, photos and packing; `lib/compliance/aql.ts` returns exactly the shapes `lib/kpp/input/quality.ts` wants. One call, in a file Z8 does not own | orchestrator |
| A20 | X4 | `lib/validation/results.ts:59` `readValidationResults` | exists, and **nothing reads `validation_results` on a screen**, though F-0 requires every surface to render the same version identically | orchestrator |
| A21 | X6→X4 | `lib/factory/profile.ts` `buildFactoryProfile` | produces the right type and nothing reads it; `lib/validation` still loads the older `factory_profiles`. Two read models side by side | orchestrator |
| A22 | X8 | `lib/moderation/*` `screenText`, `screenGeneration`, `screenBeforeOrder` | three of the four hooks are called by nothing — decision 0073 says "wired in wave 2", and they were not. Only uploads are screened | orchestrator |

### B. An interface with only a test double, and no production implementation (12)

| # | WS | Where | What is not wired | Owner |
|---|---|---|---|---|
| B1 | Z5→Z6 | `lib/teamwear/ideas.ts:47`, `components/teamwear/Configurator.tsx:127` | **Z6's "ideas" seam, deliberately empty.** `IdeasSource` has `unavailableIdeas` plus two doubles and **no production implementation anywhere** | owner: does Z6 build it? |
| B2 | Z5→Z6 | `lib/quotes/source.ts:30` `quoteSource` vs `components/teamwear/Configurator.tsx:184` | **Z6's Quote button in Z5's configurator.** The real `quoteSource` exists and is tested and has **no non-test caller**; the configurator still sets `QUOTE_UNAVAILABLE`. One line, passing the sport and club name. `e2e/teamwear.spec.ts:102` asserts the "not switched on yet" text and must change with it | orchestrator |
| B3 | L5→Y2 | `components/video/record-sequence.ts:18`, listeners in `components/garment3d/scene.ts:106` and `components/gltf/scene.ts:98` | **the carousel sequence.** Both viewers answer only `knitwright:turn`; `knitwright:camera` and `knitwright:colourway` have no listener, so the flip, kit-reveal and **home/away/GK carousel** (`lib/media/video/sequences.ts:117`) are permanently disabled | orchestrator, plus B4 |
| B4 | L2/L3→X4 | decision 0092 | **the colourway data pipeline B3 needs.** The mockup board matches a colourway **by name** ("Home"/"Away"/"GK"). If a colourway role should be a field, that is a change to the design object, which no wave-3/4 workstream owns | owner, then X4 |
| B5 | L6 | `lib/flows/capabilities.ts:45,52` | `FlowCapabilityRegistry` is **empty in production**: every board runs `stubCapability()`. Register L2's, L3's, L4's and L5's | orchestrator |
| B6 | L6 | `lib/flows/info-card.ts:20` | `InfoCardSource` is an interface plus a double; the real reader is not written | orchestrator |
| B7 | X5 | `lib/files-service/**`, `lib/config/env.ts:89` | the whole contract has **no production caller**; the env keys are unset everywhere, so all eight operations answer `not_available`. The Python service does not exist | owner |
| B8 | Y3 | `lib/panel-layers/library-ports.ts:68` | three Library ports have refusing stand-ins: Pantone TCX needs a licence and a key (**money**), the sport-graphics library needs a merchandise licence, "Your library" needs a reader | owner, then wiring |
| B9 | Z1 | `lib/inspiration/ports.ts`, `lib/inspiration/server.ts:9,71,83` | `ArticleContext`, `BrandMoodReader`, `LibraryReader` and `DesignChecker` fall back to the unwired versions; the suggestion path still passes `UNWIRED_PORTS` even though `lib/validation/live-ports.ts` now exists. One-line swap | orchestrator |
| B10 | Y5→Y4 | `lib/techpack/exports/review-gate.ts:13` | `ReviewState`/`ExportGate` is the smallest shape of Y4's Review tab; the shell must hand the tab's summary across the slot seam. Blocked on A9–A11 | orchestrator |
| B11 | L7 | `lib/brand-studio/import/style.ts` | the visual-style writer is an interface with a deterministic stub; `lib/providers/text-model.ts` takes **one** picture while F-S9 asks for five or more | owner, then wiring |
| B12 | O1/Y8 | `lib/ops/contract.ts`, `lib/share/email.ts` | third-party inspection is a stub (nothing booked, no price, no turnaround); couriers are rows with only the manual option; `EmailSender` has the Resend adapter and no provider, address or subject chosen. X8's "no notice to a brand whose artwork was blocked" depends on this | owner |

### C. A declared database column or table nothing writes (21)

| # | WS | Where | What is not wired | Owner |
|---|---|---|---|---|
| C1 | L6→O2 | `20261201030000_flow_runs.sql:237` ("set by wave 5"), function `public.collect_flow_listing` at `:768`; read at `lib/store-contract/server.ts:69,83` | **`flow_listings.collected_at`: read in two places, written nowhere.** `collect_flow_listing` has **no caller in `apps/web`**, the table grants nobody UPDATE, and O2 shipped read-only endpoints. A Store-facing route that calls the function closes it | owner, then O2 |
| C2 | L6 | `20261201030000_flow_runs.sql:62` `tutorial_url`, seeded `:838` | the same shape: declared, seeded null, **not referenced once in `apps/web`** | owner: is a tutorial film going to be made? |
| C3 | L6 | `20261201030000_flow_runs.sql:107-116` `flow_template_links` | seeded and read **only by tests**; production builds the packs from `lib/flows/templates/index.ts` instead. Two sources of truth for the flow graph | orchestrator, with A4 |
| C4 | X1→Y7 | `20261101010000_base_articles.sql:95,129` `approved_by_sample_id` | read by `lib/catalogue/read.ts:53,68` and **no UPDATE path anywhere**: Y7's golden samples never write back, so every option is permanently "not yet sampled" | orchestrator + owner (warning or lock?) |
| C5 | X1 | `20261101010000_base_articles.sql:218` — `glb_model_key`, `uv_panel_map`, `parametric_script_id`, `parametric_script_version` | declared, seeded null, read, written only by the seed from `article.json`, which carries none. No 3D model and no parametric script exists for any article | X3 / owner |
| C6 | X6 | `20261101050000_factories.sql:58` | programme-fabric colour Lab null on every row, no measurement path | owner |
| C7 | X6/Z8 | `programme_fabrics.pfas_free`, `oeko_tex_cert` | null on all six fabrics, so `R-LAB-003` refuses every fabric and no label can claim OEKO-TEX | owner: ask the mill |
| C8 | X6/O3 | `price_tiers.sell_aud_minor` | null on every row, so nothing can be sold in Australia at a shown price. **Money** | owner |
| C9 | X6 | `country_rules.vat_rate_bp`, `low_value_threshold_minor`, `duty_by_hs`, `preference_scheme`, `label_rules`, `freight_days` | held as data and nothing computes a landed cost or a VAT line; freight days unseeded, so **no delivery date is promised anywhere** | owner + O2 |
| C10 | X1/O1 | `base_articles.hs_code` | null except for JSY-SS-01; the commercial invoice prints the gap | owner: customs broker |
| C11 | Z8 | `20261120070000_compliance.sql:125` `care_symbols` | seeded with **category rows only** — no symbol reference, no words, no transcribed source, because ISO 3758 is not in the repository. A row with no symbol never reaches a label, so **every real label and therefore every real export is refused today.** Decision 0089 calls it "the single biggest thing in the way" | owner: transcribe from a licensed copy |
| C12 | Z8/X5 | decision 0089 | `cpsiaCertificate` is null everywhere with nowhere to record one, so the United States stays closed and no youth garment may be made for any market | owner |
| C13 | O1 | `bom_consumption_record` | exists and is tested as refusing a non-admin, and **no screen or route calls it**: a factory's confirmed consumption figure cannot be recorded | orchestrator / ops console |
| C14 | O1 | decision 0101 | four of the article's nine published figures (back-neck tape, heat-transfer neck label, polybag, transfer paper) have **no BOM line to carry them**, so a row for any of them could never be read | owner, then X5 |
| C15 | L3 | `20261201020000_shoots.sql:77` | the model-preset likeness-licence column is null on all six rows, so nothing can be generated with a person in it | owner |
| C16 | X5 | `20261101040000_package_exports.sql:31` | `credit_prices.credits` for `production_package` is `is_placeholder = true`. **Money** | owner |
| C17 | L1/L4/L5/L6 | `20261201010000_launch_projects.sql:624`, `20261201060000_marketing_studio.sql:93` | every artboard preset and export resolution seeded "Placeholder, not reviewed by anyone"; one credit price covers AI pictures, AI video per second and flow runs. **Money** | owner |
| C18 | Y6 | `20261110010000_brand_studio.sql:50` | four `placeholder-*` font rows, `licence = 'not_established'`, with a CHECK enforcing `selectable = (licence = 'bundled')`. Only the two bundled Geist faces can ever be chosen. **Money** | owner |
| C19 | X6 | `20261101050000_factories.sql:229-286` | every capability, price tier, country rule and fabric figure is a labelled placeholder from the build pack; QC days and packing days are not set | owner + factory |
| C20 | X1/Z9 | decision 0090 | **seven of the eight launch articles have no size range, no sample size, no POM, no block, no script and no gender.** Nothing can grade, offer a size or price them | owner + factory |
| C21 | X5 | decision 0070 | `PatternSource` is fed by the pattern library's **synthetic** run; `_nest.dxf` is sizes stacked, not a nested marker; `10_reference/renders_front_back.pdf` says "no render is available" in every package | orchestrator, after B7 |

### D. One-line cross-workstream wiring in a file the author did not own (22)

| # | WS | Where | What is not wired | Owner |
|---|---|---|---|---|
| D-1 | Y1→Z6 | `lib/home/cards.ts:86` | the create-new modal's "From your crest or logo" card opens `/club`; `/crest-to-kit` now exists | orchestrator |
| D-2 | Z6 | `lib/shell/sections.ts:23` | `/crest-to-kit` has **no nav entry** even after decision 0103's overflow menu; reachable by address only | orchestrator |
| D-3 | Z7 | `lib/shell/sections.ts:23` | `/collect` has no nav entry either; decision 0087 says one is owed | orchestrator |
| D-4 | L7 | `lib/settings/registry.ts` | the `brand_import.*` keys have schemas and defaults and **no console row**, so no admin can change them | orchestrator |
| D-5 | Y2/Y4→X4 | `lib/garment/action-schema.ts:27` | **three stored-design actions do not exist**: `set-article`, `set-extra-pom`, `set-callout`. A Form-toolbar choice lives only in the URL and never reaches the design object, validation or the tech pack; a founder's own POM and a callout show on the tech pack and are **lost on reload**. Three union members plus their cases in `apply-action.ts` | owner: who owns `lib/garment`, in which wave? |
| D-6 | X4 | `components/production/validation/ValidationPanel.tsx:19` | the route accepts `approved` and the panel knows three statuses and has no "Accept for ordering" button | orchestrator / owner |
| D-7 | X5 | decision 0070 | a **batch** package has no route at all: it needs orders and a job sheet, which is ops's path | owner |
| D-8 | X2 | decision 0067 | `rulesFor({ articleCode })` needs `method` too and **no caller exists yet**; `rulesFor` also reads every version and filters in TypeScript, and PostgREST's 1,000-row cap means a rule goes silently missing past 1,000 versions (today 46; the integration test fails at 500, so nobody has to remember) | orchestrator |
| D-9 | X8 | decision 0073 | the repeat-infringer count is a number on a page, not an action: nothing is suspended at three strikes | owner |
| D-10 | Z4 | decision 0085 | no canvas drag, no left panel, no bottom dock, no colour breakdown, no in-place style-card editing. "What is left is the screen, not a migration" | owner |
| D-11 | Z5 | `lib/kit-styles/presets.ts` | `kitStyleActions` refuses **every part of a kit**: presets exist for `team-jersey`/`crew-tee` and not `football-shirt`/`football-shorts`, so no teamwear garment can carry hoops, stripes or a sash. Also blocks three of Z6's six template families | owner, then the owner of `lib/kit-styles` |
| D-12 | L8 | `lib/templates/filters.ts` | no filter panel for the five new tag columns on the library page; `matchesTags`, `matchesSearch`, `TAG_CHOICES` are pure functions "ready for the panel that shows them" | owner |
| D-13 | L8→Z6 | `template_kit_bundles` | holds the build pack's fifteen bundles and has **no browser surface at all**; crest-to-kit is the screen the spec gives them | orchestrator, Z6's screen |
| D-14 | L8 | decision 0098 | `templates.source = 'designer'` is reachable only through the submission flow; the ledger is built and nothing opens the door | owner |
| D-15 | Y4 | decision 0077 | "Show customers" is not built (it feeds the storefront, out of scope); trims and labels cannot be added because no factory list of trims exists; and **there is no table anywhere for a body size chart**, which F-S6's Body tab asks for today | owner |
| D-16 | Y3/X3 | decision 0076 | aligning a graphic anywhere but on its anchor needs the piece mapper (decision 0053), which is not built | another workstream |
| D-17 | X4 | decision 0069 | the guardrails run on almost nothing server-side: nothing turns a design's artwork stack into placed boxes on pattern panels, every exported asset is `kind: "artwork"`, and the fabric code falls back to the design's own id | orchestrator, after the piece mapper and X3 |
| D-18 | X5/X3 | decision 0070 | `lib/parametric`'s sleeve carries no `underarm-a`/`underarm-b` landmarks, so `lib/print` places sleeve artwork by the piece's bounds | owner, then X3 |
| D-19 | Z7/Y8 | decision 0087 | F-T4's per-player 3D preview is not built: the names-and-numbers renderer takes one sample name per design, not a name per player, and `lib/garment/names-numbers.ts:12` says a player's own name belongs to the team order, "which is not built yet" | another workstream |
| D-20 | L2 | decision 0092 | a scene card cannot name the design's base article because `LaunchContext` carries no design facts — "a note for L1, not a change this workstream may make to the contract" | L1 / orchestrator |
| D-21 | L2/L5 | decisions 0092, 0095 | the 360° turntable is drawn as still frames and the two paths **disagree on length**: decision 0058 says 8 s for the media-set turntable, F-L3 and the build pack say 6 s for the launch video. Both numbers are in the code | owner |
| D-22 | several | `lib/deletion/team-data.ts`; `app/globals.css` `.soft-link`; `lib/home/sidebar.ts`; `lib/teamwear/handoff.ts:13`; decision 0106 | Z7's personal-data tables missing from the erasure register (**fixed here**); `.soft-link`'s `opacity: 0.9` takes `--cobalt-soft` to 3.92:1 over the aurora across ten links; Benchmarks has two nav entries; the teamwear hand-off shows a reference, not an address; and nothing records **which design** a club's kit was settled on | mixed |

### E. Blocked on an owner decision with no code to write (19)

Condensed, because each is a purchase, a licence, a lawyer, a factory figure or a name against something, and R4's
`docs/owner/open-questions-v5.md` is the register: the Pinterest OAuth route and Standard access; Unsplash/Pexels/Pinterest
adapters that have never made a live call; F-S2's 90%-accuracy and 20-second budget, unmeasurable in CI; no paid picture
provider ever called for a shoot (`MEDIA_SHOOTS_LIVE` off); the fal board adapter never called and four video models seeded
unread; no real crest ranker and no cost figure; `render_garment` must not use klein-9b and `transfer_design` /
`composite_logo` / `detect_brand_marks` must not use SegFormer, so a commercially licensed provider has to be chosen first;
every files-service `ESTIMATED_COST` a placeholder; `CRON_SECRET` unset so the weekly cut does nothing; no measured factory
ICC profile, so print files stay sRGB and `colour_spec.json`'s Lab is computed; the package's own PDF writer has no Urdu
even though O3 shipped the strings; CMYK export refused until an ICC profile is on file; no sock article and no kit entity;
no placement table on a base article; a factory sign-in, so a rule's confirmation is still typed by a platform admin on the
factory's behalf; the WhatsApp adapter sends plain text, which Meta allows only inside a 24-hour window, and the factory's
number is unseeded; the nine open drafter questions of decision 0068, all blocking real geometry; and the fifteen
`OWNER-QUESTIONS.md` files carried over from v1 to v4, of which `gltf`, `credits`, `providers`, `intent`, `legal` and
`garment/registry/teamwear` block v5 wiring.

### Two seams worth naming on their own

- **The erasure gap behind D-22.** Registering Z7's tables (fixed here) does not make them erasable. A pin, a vote and an
  approval are append-only by trigger and a sign-up entry has no erase function, unlike `roster_players` and
  `club_invitations`. A committee member who asks for their words to be removed can be answered today only by deleting the
  whole design. **Owner question: should `erase_committee_pin` and `erase_signup_entry` exist?**
- **`lib/compliance` (A18) and `care_symbols` (C11) compound.** Z8's checklist is called by nothing, and it reads a table that
  cannot hold a value. Either on its own is a seam; together they mean no export of a real garment is possible and no code
  path would notice if the checklist were wrong.

---

## 3. `R-GAP-000`: the aggregate

588 textual occurrences resolve to **102 distinct subjects in 14 groups**. Counts below are distinct subjects, not
occurrences. **29 subjects were opened by two or more workstreams independently**, which is the number that matters: it says
the same hole was found from several directions, so closing one entry closes several screens.

| Group | Distinct gaps | The ones opened more than once |
|---|---|---|
| Money, pricing and costing | 9 | **what a generated picture, board, clip or flow run costs, in credits and in model spend — opened five times (L1, L3, L4, L5, L6), the most duplicated gap in the repo**; a price line with no tier in the chosen currency (Y1, O3, O2); freight days and freight per piece (X6, Z4) |
| Factory terms, capacity, fabric programme | 8 | lead time, MOQ and weekly slot capacity (X6, X4, Y1); a fabric with no programme row (Y1, Y3) |
| Colour and printable gamut | 3 | **the printable sublimation gamut (Y6 opened, L7 reused by name rather than renaming — the model for how this should be done)** |
| Licences, rights and IP | 6 | which fonts the platform may use for a brand and on a garment (Y6, L7, 0108); how a brand proves a pasted address is its own (L7, 0108); whether a generated picture may become artwork (L1, L6) |
| Markets, tax, duty and labelling | 12 | VAT/GST, duty, the low-value threshold and the preference scheme (X6, Z6, O3); the care wording a market requires (Y1, Z8); the importer / responsible-person address (Z8, O3); HS code and the customs document (O1, Y4); a delivery date with QC and freight days unset (Y7, O3, O2) |
| Measurement, fit and pattern | 7 | no factory-checked master pattern, and its tolerance (X3, X4, L8); the pattern fills P00–P02 (X1, Y2, Y3); a request naming something the catalogue does not offer (X3, X4) |
| Tech-pack fields, documents, option codes | 6 | a bill-of-materials line (Y4, Z8); no published catalogue code for a design choice (X5, 0099); "a render, not a photograph" (Y5, Y1, L2) |
| Moderation | 4 | every moderation reason at every severity (X8, X4, Z8); the picture checker's thresholds and frames sampled (L3, L5) |
| Inspiration, benchmarks and Ask | 5 | — |
| Launch, mockups, marketing, video, flows | 22 | which model presets a scene allows (L2, L3); where the turntable clip is cut (L2, L5); export resolution beyond 72/300 dpi (L4, L5) |
| Templates, bundles, library | 6 | a kit bundle has no socks, because socks are a registry type mapped to no base article (L8, Z5, Z6) |
| Store contract and hand-offs | 4 | the Store hand-off itself (Z5, O2) |
| Names, numbers, repeats, links | 6 | number-zone character lengths (Z7, O2); sport number ranges and leading zeros (Z7, O2) |
| Drawing aids and UI affordances | 4 | — |

Three things X2 and the owner should know:

1. **X2 is both the owner of this backlog and the only workstream that can close an item on it.** The rulebook seeds
   `R-GAP-000` itself (version 1, draft, topic null, claiming no scope) and the `rulebook_gaps` table that counts hits.
2. **Two rulebook work items are not `R-GAP-000` and would otherwise be missed**: the topic map has **no `SHO` family**
   (which the build pack's own `R-SHO-002` needs) and **no `FAB` family**, both X2's file, which Z9 could not add; and
   `R-CON-010` is unassigned while the build pack uses `R-CON-011` and JSY-SS-01's rulebook ends at `R-CON-009`. Also
   rulebook-owned but not a gap: the `R-SUB-004` 15 mm against `safe_zone_mm` 10 mm discrepancy (decision 0076 Q1).
3. **Take the machine-readable lists as the input, not the prose.** `lib/marketing/rules.ts` (`MARKETING_GAPS`),
   `lib/mockups/gaps.ts` (`allMockupGaps()`), `lib/techpack/exports/pages.ts` (`PAGE_GAPS`),
   `lib/brand-studio/import/words.ts` (`IMPORT_RULE_GAPS`), `lib/benchmarks/vocabulary.ts` (`BENCHMARK_RULE_GAPS`),
   `lib/templates/seed/australia/plans.ts` (`AUSTRALIA_GAPS`), `lib/launch-panels/words.ts`,
   `lib/templates/seed/bundles/build.ts` (`SOCKS_GAP`) and `lib/validation/rules.ts` (`CHECK_RULES`/`READINESS_RULES`, the
   largest enumeration) are all test-pinned and will not drift.

Two workstreams opened no gaps at all and say so: Z9 (*"No `R-GAP-000`. Every rule, range and check this workstream writes
carries a real rulebook id"*) and X7.

### Nobody invented a rule's text, and nobody invented a rule id

Every `R-<TOPIC>-<NNN>` literal in non-test `lib`, `app` and `components` resolves to a rule a published
`docs/spec/articles/*/rulebook.md` states, or is `R-GAP-000`. The two that do not are a format example in the admin rule
editor's hint (`components/rulebook/RuleEditor.tsx:44`, *"For example R-SUB-009"* — an id that deliberately does not exist,
so no real rule's text can be read into it) and `R-TOPIC-001` in a doc comment. `lib/rulebook/sources.ts` goes further than
the rule asks: it refuses to file a note that only *asks* the factory for something ("Factory to confirm…") as the factory's
word, and `misfiledAsFactory` is a predicate over that. This is the most careful thing in the review.

**One finding.** `lib/brand-studio/import/fonts.ts:79` prints *"the rulebook asks for a minimum line of 0.5 mm"* as a string
literal, and three more files restate rulebook figures in doc comments. The figures are correct (`rulebook.md:72`, R-SUB-007)
and the code carries the right rule id — but `rulebook_entries` is a table and there is a whole `lib/rulebook`, and **no test
holds any in-code rulebook figure to the row or to `rulebook.md`**. If the entry changes, that sentence silently tells a user
the wrong tolerance. Staleness, not invention; a one-test fix for X2 or Y6.

---

## 4. Invented values

The plan's hardest rule holds better than expected. The newest workstreams are the most careful ones.

**Clean, and worth naming because each is a pattern to copy.** `supabase/migrations/20261210020000_bom_consumption.sql` is
the gold standard: `source_file` + `source_label` + `source_quote` + `confirmed`, the quantity stored as **text** so it is
quoted rather than re-rounded, an append-only trigger, and a test that fails if a figure differs from `article.json` word for
word. `lib/collections/landed.ts` makes every missing figure a sentence and never a zero. `lib/markets/tax.ts` takes every
figure from a `country_rules` column and shows nothing as charged while `tax_registered` is false.
`20261120050000_committee_signup.sql` gives all four rule tables a mandatory `note` column and fills every seeded row with a
provenance sentence, and `lib/clubs/signup/zones.ts:46` has **no fallback that invents a range** — a sport with no row is a
sport the club cannot choose. `20261120070000_compliance.sql` seeds care symbols with `words` null under
`check (words is null or source is not null)`. `lib/ops/inspection/settings.ts:16` turns the spec's 300 into a `SettingDef`
with a `fallback` and `help` citing F-O3, which is what every "Knitwright default" should look like.

| # | Where | Finding | Status |
|---|---|---|---|
| H3 | `article_poms` | see HIGH | open |
| M6a | `lib/techpack/production/readiness-pattern.ts:7,63,72,73` | `SEAM_TOLERANCE_MM = 2` — **no rule id, no setting, no row, no citation**, only a restatement in a comment. It is the pass/fail predicate for the `pattern-seams-agree` readiness item **and** is interpolated into two sentences a user reads: *"A technician fixes the seams that differ by more than 2 mm"*, *"Joined seams agree within 2 mm or the ease the pattern states."* An unsourced tolerance that decides whether a design is "ready for the factory" | open |
| M6b | `lib/techpack/production/readiness.ts:26,88` | `REDUCTION_TOLERANCE_PCT = 0.5`, same shape. Note the asymmetry: the code is scrupulous that the stretch figure must be `source === "fabric-test"`, then judges it against an invented window | open |
| M6c | `lib/cutting/marker.ts:38,63,72,78` | `DEFAULT_GAP_MM = 5` — the gap between pieces in the marker lay, **zero comment, zero citation**. It changes the estimated fabric consumption, and while the output carries `ESTIMATE_LABEL` and `lib/cutting/fabric-use.ts:48` builds an `assumptions[]` list, that list names the efficiency and the usable width and **not the gap**: the one input that silently moves the number is in no assumption. Severity is held down only by `stripPackingEstimator` having no production consumer yet — which is itself worth knowing before it gets one | open |
| L9a | `lib/cutting/fabric-use.ts:13` and `lib/techpack/production/pattern-cutting.ts:12` | the 80% marker efficiency is a constant in **two** files with no test holding them together. Both are correctly labelled ("Knitwright default, not from your factory/marker") and `fabric-use.ts:50` prints the label beside the figure, so this is a "Data, not constants" item, not an unlabelled placeholder: it should be a `SettingDef` like `ops/inspection/settings.ts` | open |
| L9b | `lib/make/vocabulary.ts:29-34` | Class B run quantities (50–300) and `QUOTE_QUANTITIES` as code constants while `factory_capabilities.moq` exists as a row. Out-of-range is a **warning**, not a blocker, the real MOQ check reads the row, and the user-facing text says *"Knitwright draft range, not a quantity a factory has refused"*. "Data, not constants" only | open |
| L9c | `lib/benchmarks/design-around.ts:38-41` | `SILHOUETTE_WARN_AT = 3` ("A draft number"), `LAYOUT_WARN_AT = 3` ("Also a draft number") and **`LAYOUT_WARN_SHARE = 0.7` with no comment of its own**. They gate two user-visible warnings on an IP-adjacency screen: a legal-adjacent judgement decided by a number nobody reviewed. Mitigated by the findings carrying `R-GAP-000` and the thresholds never reaching the user | open |
| L9d | `lib/teamwear/pricing.ts:21` | `quantityFloor = (source?.moq ?? 1) || 1` — an unsourced default standing in for an unagreed MOQ. Benign in direction; it decides only a stepper floor | open |
| L9e | `lib/store-contract/fixtures/samples.ts:38` | the fixture's AUD/GBP ratios are **1.931 / 1.920 / 1.909** — the AUD column looks derived from the GBP one, and decision 0104 explicitly refuses exactly that (*"An exchange rate would produce a plausible A$56.20"*; the fixture's first band is A$56.00). Test-only, every label says "test", and no non-test file imports it. Stylistic — but it is the number the decision record refused, one copy-paste from a seed | open |

**Two guards are weaker than advertised, which matters because they are the ones people cite.**

1. O1's AQL rows: the CHECK at `20261210010000_ops_completion.sql:73,100` is `check (source is not null or not sourced)`,
   i.e. *sourced implies source is not null*. It does **not** enforce `sourced = false`; that comes from the column default
   plus the seed omitting it. Nothing stops `UPDATE … SET sourced = true, source = 'x'`, and `source` need only be 1–300
   characters of anything. The shape is right and the constraints beside it (`reject_at = accept_at + 1`, the plan-or-arrow
   check) are genuinely strong. The claim that the AQL rows never decide anything **does** hold: `lib/ops/aql/plan.ts:122,161`
   propagate `sourced` as an AND across every row, and the pass/fail verdict rests on the inspector's typed measurements and
   the factory's own `colour_delta_max`.
2. The "no digit appears in the AUD price UI" tests operate on view models and payloads, not on rendered output.
   `lib/markets/view.test.ts:35` asserts the exact sentence and carries the weight; line `:37`'s digit check is then
   tautological. `lib/store-contract/money.test.ts:73` is the better guard (it asserts the gap object has **no amount field
   at all**), while `:80`'s substring search for `"29"` cannot fail given the object provably holds no digits. Sound, but if
   the claim is meant to be about the screen, that is the gap to close.

**No currency conversion exists anywhere.** Grepped for every shape; the only `exchange*` hits are
`auth.exchangeCodeForSession` and chat "exchangeLines". See §1 for the three modules that actively refuse.

---

## 5. Limits, and anything that reads as a half-refactor

- **No file is over 400 lines.** The largest source file is 356 (`lib/techpack/types.ts`), over 2,400 source files. This rule was unenforced; it now has a test
  (`tests/architecture/file-length.test.ts`).
- **Four non-fixture `lib` functions are over 50 lines**: `lib/benchmarks/store.ts:87 createSupabaseStore` (94 — a factory
  holding every operation, the same shape the v4 review split out of `lib/credits/service.ts`), `lib/flows/server.ts:99
  runFlowForBrand` (57), `lib/teamwear/actions.ts:39 handler` (54), `lib/kpp/sources/server.ts:70 readRows` (53). Each is its
  own workstream's to split; none was touched here, because a behaviour-preserving split of four modules is a refactor this
  review cannot prove in the same PR as its findings.
- **`components/launch/useLaunchShell.ts:104 useLaunchShell` is 201 lines and is a hook, not JSX.** The v4 review excused long
  components as JSX bodies with nesting 0 or 1; this one is not that. It is the single worst non-JSX offender in the tree and
  the one to split first. The next are `components/mockups/MockupBoardPanel.tsx` (223), `components/brand-studio/PicturesPanel.tsx`
  (175), `components/studio/editor/repeat-maker/index.tsx` (175), `components/flows/FlowRunPanel.tsx` (172) — all JSX.
- **Nesting over 4**: 14 sites, in `lib/flat/geometry.ts`, `lib/intent/extract-json.ts`, `lib/artwork-intake/vector/xml.ts`,
  `lib/pattern-library/dxf/parse.ts`, `lib/print/layout/vector-art.ts`. All are flood fills or character-level readers.
- **Half-refactors.** Two read that way. `lib/factory/profile.ts`'s read model is built and unread while `lib/validation`
  still loads the older `factory_profiles` (A21), so two read models of the same thing are live. And
  `lib/flows/templates/index.ts` builds the flow packs in code while `flow_template_links` holds the same graph in rows read
  only by tests (C3). Both are one deletion away from being finished and one more workstream away from being load-bearing.
- **Coverage thresholds.** Every v5 `lib` directory has its 90% entry; the 31 without one all predate v5. The bare-name
  list is one name per line and in order, and `tests/architecture/coverage-config.test.ts` holds that. It does **not** hold
  that the explicit `"lib/x/**": { … }` blocks above the list still exist — the failure mode the plan warns about (rewriting
  one as a bare name silently drops its 90% requirement, caught once only by typecheck) is still unguarded. A finding, not
  fixed here, because the fix belongs beside that test rather than in a review PR.

## 6. Wording

`lib/techpack/wording.test.ts` was satisfied by accident in two ways, and the first is H4.

1. **The techpack scan read one folder at a time** — `readdirSync` without `recursive`, with each folder listed by hand.
   `lib/techpack/exports/**`, `lib/techpack/view/**` and the `bottoms`, `close-fitting`, `outerwear` and `teamwear` registry
   families were never read. **Fixed**: each root is now read recursively, a test names the eight folders that were missing so
   the recursion cannot be undone silently, and inserting a settled sentence into
   `lib/techpack/exports/pdf/marks.ts` now fails the scan where it previously passed. Three sentences the newly read files
   already hold are allowed, each of which says nothing has been checked; and the tech pack view's provenance chip —
   **"Confirmed"**, spec F-S6's own fourth word and X5's `FIELD_PROVENANCE` key from
   `docs/spec/04-production-package.md` — is allowed in that one file through a new per-file allowance that may hold a word
   but never a sentence, with a test proving it applies nowhere else.
2. **The wide scan's `isProse` filter skips any string without whitespace**, so a single-word label carrying a settled word
   would pass. Checked: all 42 such strings in the scanned folders are status identifiers (`"passed"`, `"approved"`,
   `"validated"`, `"confirmed"`, `"verified"`) or Tailwind class lists containing `has-[:checked]`. **Nothing is wrong today**,
   but the guard rests on a heuristic, and a rendered one-word chip is exactly what finding 1 turned up in the folder it was
   not reading. Left as a finding: tightening it means distinguishing an identifier from a label, which the test cannot do
   from a string literal alone.
3. The wide scan's `WIDE_ALLOWED` list has **no "every allowance is used" test**, unlike `ALLOWED`. A stale allowance can
   linger, and because allowances are removed by substring, a broad one such as `"approved version"` blanks the word
   `approved` wherever it is followed by `version`. Minor; noted so the next person to add one knows.
4. `lib/media/video/clip.ts` (*"a lifestyle picture that passed the check"*) and `lib/media/lifestyle/register.ts`
   (*"passed the first time"*) are still allow-listed and still owner questions, carried from the v4 review's L8.

---

## Fixed here

Four, each with a test that fails without it. Nothing else was changed: no migration, no `Sportswear/`, no `kitwright/`, no
`supabase/config.toml`, and `apps/web/vitest.config.mts` is untouched.

| # | What | Proof |
|---|---|---|
| H4 | The techpack settled-words scan reads each root recursively, so `lib/techpack/exports/**`, `lib/techpack/view/**` and the four unscanned registry families are covered. Three negated sentences allowed; the F-S6 provenance chip allowed in its one file through a per-file allowance that may hold a word and not a sentence | a test names the eight previously unread folders and fails if any is not scanned; a test proves the per-file allowance applies to no other file; inserting a settled sentence in `lib/techpack/exports/pdf/marks.ts` fails the scan |
| D1 | One list of addresses that are not a public web page, `lib/http/public-url.ts`, asked for by L7's own comment. Both fetchers import it. The copies were byte-identical, so nothing about which address is refused changes | `lib/http/public-url.test.ts` covers the list from both sides, drives both fetchers through it without letting either reach the network, and **fails if a third copy of the list appears anywhere under `lib`, `app` or `components`** — which was the state before this change |
| D-22 | Z7's nine committee-link and roster-sign-up tables are on `PERSONAL_DATA_TABLES`, the register of what holds people's names. The rows already cascade from `committee_links`, `roster_signup_links` and `club_seasons`, so the database is unchanged; what was missing was the register and so the guard | the test now reads Z7's migration, checks the key shape of all nine, and fails if a table that migration creates is neither listed nor one of the four platform rule tables — the shape the ops-QC, club and comments migrations already had. Removing one entry makes it name that table |
| §5 | `tests/architecture/file-length.test.ts` holds the plan's 400-line file rule over `lib`, `app` and `components` | the rule is satisfied today with zero violations; the test names any file that goes over, and asserts the scan is not vacuous |

## Deferred, with the owner question each needs

H1 (may a viewer spend a brand's credits? — also R1's), H2 (should a vector crest be read at 150 DPI everywhere?), H3
(nullable tolerances with provenance, and a provenance column on `pom.csv`?), the nineteen other duplicate groups of §1 (each
names its winner; D15, D18 and D21's `£` literal are the cheapest), the three unsourced tolerances of §4 (should
`SEAM_TOLERANCE_MM`, `REDUCTION_TOLERANCE_PCT` and `DEFAULT_GAP_MM` become labelled settings, and should the marker gap join
the assumptions list?), the erasure gap behind D-22 (should `erase_committee_pin` and `erase_signup_entry` exist?), the four
long `lib` functions and `useLaunchShell`, the unguarded explicit coverage blocks, and the two wording items carried from v4.

Everything in §2 is a seam, not a defect: each one is a workstream that stopped at its boundary and said so, which is what
the plan asked for. The table exists so that none of them is now anybody's surprise.
