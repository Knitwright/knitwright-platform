# 0071: The factory model as data

Status: Proposed
Date: 2026-10-29
Plan step: `plans/platform-v5.md`, wave 1, workstream X6. Spec: `docs/spec/02-features.md` F-O1, F-S7, F-S8 and F-T5,
`docs/spec/03-data-model.md` ("Factory profile (read model)"), `docs/spec/01-product-direction.md` decisions 2, 3 and 4
and its pricing anchors. Builds on decisions 0039 (the validation gate's `FactoryProfile`), 0043 (the ops console) and
0056 (platform settings).

## Context

Until now the platform held one factory as a single JSON column (`factory_profiles`, decision 0039) whose every term was
"not set", and the weekly cut-off was two numbers in `lib/settings` interpreted as UTC. The build pack needs more: a
factory with a city, a WhatsApp number and certifications; what that factory makes, on which fabric, with a lead time, a
minimum order, a weekly slot and a colour tolerance; a price ladder per article and quantity in two sell currencies; the
fabric programme with its stock colours; and market rules so the US and the EU can open later without a schema change.
It also needs a promised date that is the sum of real parts, and a cut-off that means *Monday noon in Sialkot*, not
Monday noon UTC.

## Decision

1. **Six tables** (`supabase/migrations/20261101050000_factories.sql`), all platform data, none owned by a brand:

   | Table | Holds |
   |---|---|
   | `programme_fabrics` | The fabric programme (F-S8 spec cards): code, name, class A or B, blend, gsm range, stretch, finish, PFAS-free, OEKO-TEX, sublimatable, swatch reference |
   | `programme_fabric_colours` | Stock colours for Class B: name, hex, CIE Lab (null until a swatch is measured), Pantone |
   | `factories` | Partner factory: slug, name, city, country, **time zone**, WhatsApp contact, certifications with expiry, status |
   | `factory_capabilities` | Factory × base article code × fabric code: lead time (working days), MOQ, weekly Class A slot, file formats accepted, golden sample status, colour ΔE max |
   | `price_tiers` | Per capability: quantity from/to, factory cost (minor units + currency), sell GBP, sell AUD, personalisation cost |
   | `country_rules` | Per market: currency, VAT in basis points, low-value threshold, duty by HS code, preference scheme, label rules, freight days, selling enabled |

   Money is **integer minor units plus a currency** (spec conventions); rates are **basis points** (2000 is 20%); a
   missing value is **null, never zero**. Article and fabric codes are plain text, not foreign keys into X1's
   catalogue, so the two workstreams merge independently; `factory_capabilities.garment_type_id` names the existing
   garment registry type so the validation gate keeps working.

2. **Who reaches what.** `factories`, `factory_capabilities` and `price_tiers` hold the factory's contact and
   Knitwright's cost prices, so **no browser role holds any privilege on them at all** (spec decision 1: a customer must
   not be able to cut the factory in or out). `programme_fabrics`, `programme_fabric_colours` and `country_rules` are
   catalogue data every signed-in member may read (a fabric card, the VAT treatment) and no visitor. All six have RLS
   on, with select policies only for members on the three readable ones and **no insert, update or delete policy at
   all**. The server's key holds SELECT, INSERT and UPDATE; nothing holds DELETE, so a fabric a capability depends on
   cannot vanish under it. Writes go through the app after `assertPlatformAdmin`, the same model as `factory_profiles`.
   Every row records `updated_by` and `updated_at`.

3. **Every row says which rule explains it.** `factory_capabilities`, `price_tiers`, `programme_fabrics` and
   `country_rules` each carry a `rule_id` (format `R-<TOPIC>-<NNN>`), plain text so X2's `rulebook_entries` can land
   separately. Seeded: `R-SUB-001` on the four sublimated fabrics, `R-COST-003` on the club price ladder, and
   `R-GAP-000` everywhere else. The `R-GAP-000` uses are listed under "Gaps" below.

4. **`buildFactoryProfile(snapshot)`** (`lib/factory/profile.ts`) produces the **existing** `FactoryProfile` type
   (`lib/validation/profile.ts`, which X4 owns and this workstream only reads), so a design can be validated against
   rows instead of against a hand-written JSON column. The mapping:

   | `FactoryProfile` field | From |
   |---|---|
   | `id`, `name`, `label` | the factory's slug, name and source line |
   | `articles[].typeId` | `garment_type_id`, or the article code in lower case while no registry type maps to it |
   | `articles[].moq` | the **smallest** agreed MOQ across that type's capabilities |
   | `fabrics[]` | one per fabric a capability uses: `"<code> <name>"`, its swatch reference, and the **strictest** agreed ΔE |
   | `priceLadder` | the GBP ladder of the first capability (by article code, then fabric) whose every tier has a GBP price, in pounds, as the old type holds them |
   | `leadTimeDays` | the **longest** agreed lead time, so no article is promised sooner than it can be made |
   | `fileFormats` | every format any capability accepts, lower case, without repeats |
   | `structuralOptions`, `hsCodes` | not held here: the catalogue (X1) and the commercial invoice own them, so both stay "not set" |

   A value no row gives is `{status: "not-set"}`, exactly as in the seeded default. The profile is cached per factory
   slug for 60 seconds and every write through `lib/factory/actions.ts` drops the cache (spec: "cached per factory and
   invalidated on change"); the time limit is there because several server processes serve the app and only the one that
   made the change can drop its own cache.

5. **The cut-off is data, read on the factory's clock.** Three settings join the settings registry through
   `lib/settings/extensions.ts` (decision 0056): `production.class_a_cutoff_weekday` (placeholder Monday),
   `production.class_a_cutoff_minutes` (placeholder 12:00) and `production.qc_days` (**not set**: nobody has agreed
   one). The time is read in the factory's own IANA zone, which is a column of `factories`, so "Monday 12:00" means noon
   in Sialkot whatever the reader's clock says. The keys start with `production.` on purpose, so decision 0056's
   write-through of `factory.*` and `ops.*` keys into the old `factory_profiles` and `ops_settings` rows does not touch
   them. The existing `ops.cutoff_*` settings and `lib/ops/cutoff.ts` are untouched; nothing of the old batching path
   changes in this workstream.

6. **Zone arithmetic with no dependency.** `lib/factory/zoned.ts` does wall-clock arithmetic in a named zone with
   `Intl.DateTimeFormat` alone: the platform's own ICU data knows every IANA zone and its summer-time rules. A wall time
   that happens twice (an autumn overlap) resolves to the earlier instant; one that never happens (a spring gap)
   resolves to the instant just after the gap. Pakistan keeps UTC+5 all year, which is why the cut-off is set there, but
   the tests hold London and Sydney through both of their changes. **No new dependency** was added.

7. **`promisedDate` = cut-off + lead time + QC + freight** (spec F-S7 acceptance). Lead time and QC are working days,
   Monday to Friday; freight is calendar days from `country_rules.freight_days`. Class A counts from the next weekly
   cut-off; Class B counts from the order's confirmation (F-O1). If **any** part is missing the answer is
   `{status: "not-set", missing: [...]}` and the words name what is missing: no date is invented. A zero is a set value,
   not a missing one.

8. **`priceFor` / `priceBasket`** (`lib/factory/pricing.ts`) are pure. **Tiers are counted across the whole basket**
   (F-T5): ten jerseys and ten shorts are both priced at the 20-piece tier. Arithmetic is exact in minor units with no
   rounding anywhere, so a quote and a checkout agree to the penny. A quantity below the smallest tier, a currency with
   no price, or an article the factory does not make each come back as a named reason, never as a guess or a zero.
   `ladderProblem` refuses a ladder that overlaps, leaves a gap, or has an open tier that is not the last.

9. **An ops page, `/ops/factories`** (platform admins only; everyone else gets the 404 `requirePlatformAdmin` gives),
   with one small form per editable field of every row, built from a table in `lib/factory/edit.ts`. A field not in that
   table cannot be changed from the page: ids, the factory link, codes and the bookkeeping columns are not editable.
   Money is typed in major units ("29.00") and stored in minor units by exact string arithmetic; rates are typed in
   percent and stored in basis points; `lib/factory/view.ts` is the exact inverse, and a test holds the two together. A
   quantity change that would break a capability's ladder is refused with the problem in words. One navigation entry was
   added to the ops header.

10. **Seeds, all labelled placeholders**: one factory "Sialkot partner (placeholder)" in Sialkot on `Asia/Karachi`; the
    six launch fabric codes `F-POLY-INT`, `F-POLY-PQ`, `F-POLY-EL`, `F-POLY-4W`, `F-STK-TEE`, `F-STK-FLC`; three stock
    colours on each Class B fabric; capabilities for `JSY-SS-01` and `SHO-TR-01` on `F-POLY-INT` (MOQ 1, 8 working days,
    PDF/SVG/EPS/DXF, ΔE 1.5); the club price ladder £29 / £25 / £22 for the jersey; and GB and AU open with US and EU
    present but closed (spec decision 3). Every one of those values is listed with its owner question in the PR comment.

11. **Nothing here sells or charges.** There is no cart, checkout, payment or payout code, and no Store concept is
    touched. The price and the date are shown; money is never taken (owner decision 1 for v5).

## Honest limits

- **Not verified against a database locally.** There is no Docker in this sandbox, so `supabase/migrations/20261101050000_factories.sql`,
  `tests/integration/factories.test.ts` and the new isolation-test entries first ran in CI.
- **Nothing reads the new profile yet.** `buildFactoryProfile` produces the right type and is tested against it, but
  `lib/validation` still loads `factory_profiles` (X4 owns that read). Wiring it is a later change; until then the two
  live side by side and `factory_profiles` stays the one the gate uses.
- **One lead time, one ΔE in the old type.** `FactoryProfile` has a single `leadTimeDays` and one colour difference per
  fabric, so per-article values are flattened on the way out (longest lead time, strictest ΔE). The per-article values
  stay in `factory_capabilities` for anything that reads the rows directly.
- **`hsCodes` and `structuralOptions` stay "not set"** in the built profile: HS codes belong with the commercial invoice
  (F-O4) and structural options with the catalogue (X1).
- **The ladder in the profile is GBP only**, because the old type holds one unit price per step as a decimal number of
  pounds. AUD prices live in `price_tiers.sell_aud_minor` and are read through `priceFor`, not through the profile.
- **No public holidays.** Working days are Monday to Friday; Pakistani and UK holidays are not modelled, so a promised
  date can be optimistic by a day or two around Eid, Christmas and bank holidays.
- **Freight is one number per country**, not per carrier or service, and it is not seeded: no carrier has agreed one, so
  no delivery date is promised yet.
- **Duty is stored but not applied.** `duty_by_hs`, `vat_rate_bp`, `low_value_threshold_minor` and `label_rules` are
  held as data for the Store and for F-O4; no code in this workstream computes a landed cost or a VAT line.
- **A second factory is not modelled end to end.** The read model, the pricing and the dates all take a factory, but
  nothing yet chooses *which* factory an order goes to (spec decision 2 says launch is Sialkot only).
- **`EU` is not an ISO country code.** It is stored in `country_rules.country` as a two-letter row for the union as a
  whole, which the check constraint allows.
- **No new dependency.**

## Gaps (`R-GAP-000`)

No rulebook entry exists yet for any of these, so the rows carry `R-GAP-000`:

1. **Lead time, minimum order and weekly slot capacity** (`factory_capabilities`). The ΔE on those rows does come from
   `R-SUB-005`, and the row's source line says so, but a row carries one rule id and nothing explains the rest.
2. **VAT, duty, the low-value threshold, the preference scheme and freight days** (`country_rules`, all four markets).
   `R-LAB-002` will explain `label_rules` once label rules are written; nothing explains the tax and duty figures.
3. **The Class B stock fabrics** `F-STK-TEE` and `F-STK-FLC` (`programme_fabrics`). `R-SUB-001` covers the sublimated
   polyester fabrics; no entry covers the stock-colour programme.
4. **A tier a platform admin adds** on `/ops/factories` starts at `R-GAP-000` until someone sets a rule on it.

## Owner questions

1. **Lead time.** 8 working days from the cut-off to ready for QC is the top of the spec's "Class A in 5–8 working
   days". What has the factory agreed in writing, and does it differ by article?
2. **QC and packing days.** Seeded as **not set**, so no delivery date is promised at all today. How many working days
   from ready-for-QC to handed to the carrier?
3. **Freight days** to the UK and to Australia, per carrier and service. Also not set.
4. **The club price ladder** £29 / £25 / £22 (10–19 / 20–49 / 50+) is the build pack's target, not a quote. Is it the
   price to sell at, and what is the AUD ladder?
5. **Factory cost and personalisation cost.** The spec's $8.20–9.40 FOB and $0.80–1.80 for names and numbers are
   supplier self-claims, so nothing is seeded. What is the partner's quote, in which currency?
6. **Weekly Class A slot capacity** in pieces: not set, so nothing limits a batch yet.
7. **Colour tolerance.** ΔE CMC(2:1) ≤ 1.5 comes from `R-SUB-005`, which itself says "factory to confirm the tolerance
   they can hold". Confirmed?
8. **Minimum order per article.** Seeded as 1 for both articles, from spec decision 4 ("Class A ... from MOQ 1"). Is 1
   right for shorts as well as jerseys?
9. **The cut-off.** Monday 12:00 Asia/Karachi (F-O1). Is Monday noon in Sialkot right, and should `/ops/settings`'
   UTC cut-off be retired in favour of this one so there is one cut-off, not two?
10. **VAT and thresholds.** GB 20% with a £135 low-value threshold and DCTS preference, AU 10% with a A$1,000
    threshold: public figures, to be confirmed with a customs adviser. Also: which HS codes, and what duty under each?
11. **Certifications.** Which certificates does the partner hold (OEKO-TEX, GRS, BSCI), with what expiry, and should an
    expired certificate stop an order?
12. **The factory's WhatsApp number**: not seeded, and X7's job packet will need it.
13. **Fabric blends and weights.** Every gsm, blend and finish is the build pack's placeholder "until confirmed in the
    Phase 0 factory test". Which are confirmed, and are the Class B stock colours (black, white, navy placeholders)
    the real palette?
