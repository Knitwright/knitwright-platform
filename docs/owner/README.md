# The owner's guide

Everything in this repository that is yours to decide, do or buy — and, first, the truth about what
the platform can and cannot do today. Written 2026-11-02, after all thirty workstreams of plan v5
merged (decision 0115).

---

## The platform cannot place a real order today

Thirty workstreams built the studio, the tech pack, the production package, the factory job packet,
ops, the Launch surface and the Store contract. None of it can put a garment into a factory, because
of six things. **Four of them are purchases or decisions only you can make, and no further
engineering moves any of them.**

(Some of what was built is not yet joined up to a screen — the known gaps are listed at the end of
[`../launch-checklist.md`](../launch-checklist.md) — but none of those gaps is why an order cannot be
placed. The six below are.)

This is deliberate, and it is the rule the whole platform is built on: nothing a factory reads is
invented. Where a value is missing the screen names what is missing instead of filling it in. So the
list below is short, exact, and entirely actionable.

### 1. ISO 3758 is a paid standard and is not in this repository

No care symbol and no care wording exists, so **no label prints for any market**, so the production
package is refused for every market, so nothing may be sent to a factory.

The `care_symbols` table is ready and holds only the five categories the standard is built from, each
citing `ISO 3758:2012` and nothing more, with `symbol_ref` and `words` null and `confirmed` false. The
table's own database checks refuse words with no source behind them and refuse a `confirmed` row that
is not a whole row, so the database cannot hold an unsourced care instruction even if someone tried to
write one — `tests/integration/compliance.test.ts` proves both refusals against the real database. And
`tests/integration/australia-and-translate.test.ts` asserts, in a test called "holds no care symbol, no
care instruction and no words of the standard anywhere", that every row's symbol and words are still
null.

Three separate workstreams hit this and **none of them invented a symbol.** What it needs is a licensed
copy, five to about twenty rows transcribed from it, and a name against them — or the wording from the
factory's own licensed copy.

> Decision [0089](../decisions/0089-compliance-and-pre-export.md) question 1,
> [0104](../decisions/0104-australia-and-translate.md) question 3. Group C1 of the question list.

### 2. No AUD price exists

`price_tiers.sell_aud_minor` is **null on all three tiers**.
`tests/integration/store-contract.test.ts` asserts every row is still null, and
`lib/factory/view.test.ts` asserts that the settings form shows an unpriced AUD row as the empty
string rather than a figure — so no digit appears where an Australian price would, and nothing sells
in Australia at a shown price. Australia is otherwise open: its country rules, its GST trigger, its
label rules and its starter templates all exist.

It needs one answer: a conversion rule off the GBP ladder, or a second ladder quoted in AUD.

> Decision [0104](../decisions/0104-australia-and-translate.md) question 1,
> [0071](../decisions/0071-factory-model-as-data.md) question 4,
> [0074](../decisions/0074-studio-home-and-catalogue.md) question 2. Group A3.

### 3. QC days and freight days are both unset, so no delivery date can be shown anywhere

`production.qc_days` deliberately has no default ("Leave empty while none is agreed: no delivery date
is promised"), and `country_rules.freight_days` is null for every market. The date builder refuses to
invent a date from a missing part, so **every page that would show a promised delivery date names what
is missing instead** — the make flow, the quote PDF, the Store contract, the teamwear configurator.

It needs two numbers from the factory and the carrier: working days from ready-for-QC to handed to the
carrier, and freight days to the UK and to Australia per carrier and service.

> Decision [0071](../decisions/0071-factory-model-as-data.md) questions 2 and 3. Groups B2 and B3.

### 4. No Pantone data ships, so no Pantone number is given anywhere

Pantone's colour values are licensed and this repository holds none. A brand can type its own TCX code
and the platform shows it as the brand's own; nothing is ever matched for it, and a wording test
enforces that silence — it fails on any sentence of the form "Pantone 19-4052".

It needs a decision: licence the TCX library, or keep asking brands to read their printed swatch book.

> Decision [0105](../decisions/0105-crest-to-kit-and-quote.md) question 1,
> [0079](../decisions/0079-brand-studio-manual.md) question 3,
> [0076](../decisions/0076-view-2d-and-library-toolbar.md) question 2. Group C2.

### 5. Seven of the eight base articles publish no measurement at all

Only `JSY-SS-01` has a point-of-measure table. `SHO-TR-01`, `JSY-LS-01`, `CRK-SS-01`, `TEE-TR-01`,
`HOD-ST-01`, `CMP-LS-01` and `FSH-MM-01` hold a drafted brief, a code, a class, sport tags and allowed
fabric codes — and no POM, no range, no option and no construction row. **Their tech packs and size
charts are therefore refusals**, and the drafter answers "not drafted yet" in every size.

It needs, per article, from the factory: the pattern and size chart, the POM table with grades **and**
tolerances, the construction table, seam allowances and thread, and the fabric's real code, weight and
blend.

> Decision [0090](../decisions/0090-remaining-base-article-data.md) questions 1 and 6. Groups B30, B31.

### 6. The hosted deployment is entirely owner actions

Nothing in this repository can do any of it:

- the **hosted Supabase project** and its keys, with the **"Before user created" hook switched on** in
  the dashboard — *without it anyone can register, whatever the sign-up switch says, so check it first*;
- **Vercel on Pro**, with Node 22 or 24;
- **Resend** (or another sender) with a sending address, for invites and customer status emails;
- **Google OAuth** for Google sign-in;
- **Turnstile with real keys** — a deploy refuses Cloudflare's test keys;
- **an EU Sentry project** for `MONITORING_DSN`, with one test error seen to arrive;
- **AI provider keys with spend limits set in each provider's console**;
- and the legal documents in [`../legal/`](../legal/) — terms, privacy notice, data-processing terms —
  **approved by you and a lawyer, every `[square bracket]` filled, and each document's `status` in
  `apps/web/lib/legal/` set to `"approved"`** (then run
  `pnpm --filter web exec tsx scripts/write-legal-docs.mts`). The sign-up switch may not open before
  that.

> [`../runbooks/supabase-hosted.md`](../runbooks/supabase-hosted.md) and
> [`../launch/sign-up-switch.md`](../launch/sign-up-switch.md), which is the gate you sign.

### What is *not* in the way

Worth saying, because it is the other half of the picture. A real order does also need a signed-off
**golden sample**, which needs a physical sample round with the factory; that is the ordinary business
of starting production, not a gap in the platform. And `CREDITS_ENFORCED` is off, so nothing is charged
to anyone — which is a decision to take on purpose in production either way (the server logs a warning
at start while it is unset).

---

## Your questions, all of them, in one place

Thirty decision records each ended with questions for you. There are **235** of them, in thirty files,
which is why they now live in one list — plus the seventeen items of 2026-10-15, recovered, for **252**
in all:

### → [`open-questions-v5.md`](open-questions-v5.md)

They are grouped by **what kind of answer each needs**, because the answers come from different places
and nearly all of it can be chased in parallel:

| Group | What answers it | How many |
|---|---|---|
| A | Money: a price only you can set | 21 |
| B | A factory's or a supplier's figure | 59 |
| C | A licence, a purchase or an account | 20 |
| D | A lawyer or an adviser | 17 |
| E | A product decision, yours alone | 112 |
| F | A name against something | 6 |
| P | The seventeen items of 2026-10-15 | 17 |

**One session with the Sialkot partner's pattern master and production manager answers most of group
B.** One licence purchase answers most of C. One call with a lawyer answers most of D. Group E is what
you want the platform to do and can wait as long as you like: every item in it is live behind a
labelled default today.

---

## Where to answer

| Sheet | Covers |
|---|---|
| [`questionnaire-2026-10-30.md`](questionnaire-2026-10-30.md) | Plan v5, decisions 21 onward — money, colour, sizing, factory terms, legal, wording. The **Do first** table at its top is the seven that hold up a price or a date. |
| [`questionnaire-2026-10-25.md`](questionnaire-2026-10-25.md) | Plan v4, questions 1 to 48, with a suggested answer against each one. Still live: the credit prices, the price ladder, the cut-off, the factory per article, the print house profile, the defect rate. |
| [`open-questions-v5.md`](open-questions-v5.md) | Everything the v5 records asked, grouped. Where a question is already on one of the sheets above, it says so: **answer it once, in either place.** |

"Keep it" is a valid answer everywhere, and where you write it the labelled default stops being a
placeholder and becomes your decision.

---

## The rest of the owner's documents

| Document | What it is |
|---|---|
| [`settings-console-guide.md`](settings-console-guide.md) | The platform console at `/admin/settings`: credits, the cut-off, the checks, the factory terms. What each setting does and what reads it. |
| [`size-charts.md`](size-charts.md) | **Owner action A5**: the size charts for every garment family, with [`size-chart-template.csv`](size-chart-template.csv) to fill in. |
| [`../launch-checklist.md`](../launch-checklist.md) | The one list to read before sign-up opens: what is built, what waits for you, what lives outside this repository. |
| [`../launch/sign-up-switch.md`](../launch/sign-up-switch.md) | How the sign-up switch works, the list that must be true before it opens, and the two lines of SQL that open it. |
| [`../launch/evidence.md`](../launch/evidence.md) | Acceptance criteria M1 to M7 and the evidence for each. Owed evidence is marked. |
| [`../launch/security-review.md`](../launch/security-review.md) | Security findings, with [`../reviews/security-v4.md`](../reviews/security-v4.md). |
| [`../launch/licences.md`](../launch/licences.md) | Every dependency's licence. |
| [`../runbook/ops.md`](../runbook/ops.md) | Running production: batches, the factory sheet, QC, packing, shipping, exceptions. |
| [`../runbooks/supabase-hosted.md`](../runbooks/supabase-hosted.md) | Setting up the hosted Supabase project, step by step. |
| [`../store-contract-v2.md`](../store-contract-v2.md) | The payload the separate Store reads from this platform. Give this to whoever builds the Store. |
| [`../decisions/README.md`](../decisions/README.md) | Every decision, why it was made, and its status. Generated; 107 records. |
| [`../architecture.md`](../architecture.md) | How the platform fits together, for whoever works on it next. |

`3d/`, `flats/`, `patterns/` and `reference/` beside this file hold the pictures and reference material
those documents point at.

---

## What the platform will never do, so you can rely on it

These are enforced by tests, not by good intentions, and they are why the list at the top of this page
is short and trustworthy:

- **Nothing a factory reads is invented.** A value a factory reads carries a source. Anything else is a
  labelled "Knitwright default" and is never shown as a measurement.
- **No page says a thing is settled unless a person with a name said so.** Text may say "reviewed by",
  "accepted by" or "signed by" with a name and a date, and nothing weaker.
- **Missing input never blocks the build.** It leaves a labelled default and a question for you.
- **No Pantone number, no care symbol, no measurement and no price is ever guessed** — each has a
  wording test behind it that fails the build if a sentence tries.
- **Only the server writes.** Every table has row level security and no browser write grant.
- **Generated files carry no date or random id**, so the same input gives the same bytes.
- **No paid call happens without a key.** Without one, the feature says it is not available.
