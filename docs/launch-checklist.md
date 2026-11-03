# Launch checklist

The one list to read before sign-up opens. It gathers what is built, what waits for the owner and what
lives outside this repository.

**Checked against the files on 2026-11-02**, after all thirty workstreams of plan v5 merged, and
**brought up to date on 2026-11-03**, after the four reviews of that plan and the wiring that followed
them. Every "built" line below was opened and read; where an earlier version of this list was wrong,
the line says what changed. It does not replace the detail:

- **What is actually in the way of a real order**: [`owner/README.md`](owner/README.md) — read this first
- **Every open owner question, grouped by what kind of answer it needs**:
  [`owner/open-questions-v5.md`](owner/open-questions-v5.md), 269 of them
- The sign-up switch and its "Before opening" list: [`launch/sign-up-switch.md`](launch/sign-up-switch.md)
- Acceptance criteria M1 to M7: [`launch/evidence.md`](launch/evidence.md)
- Security findings: [`launch/security-review.md`](launch/security-review.md),
  [`reviews/security-v4.md`](reviews/security-v4.md) (workstream W5-A) and
  [`reviews/security-v5.md`](reviews/security-v5.md) (R1), whose four HIGH findings are closed
  (decision 0116).
- Dependency licences: [`launch/licences.md`](launch/licences.md)
- Hosted setup: [`runbooks/supabase-hosted.md`](runbooks/supabase-hosted.md)
- The payload the separate Store reads: [`store-contract-v2.md`](store-contract-v2.md)
- How the repository is worked on: [`architecture.md#how-this-repository-is-worked-on`](architecture.md#how-this-repository-is-worked-on)

**Where this list is weaker than the sources.** "Built" means the code and its tests exist and the
decision record says so. **79 of the 120 records have status `Proposed`**, which means the orchestrator
or the owner has not accepted them yet; 39 are `Accepted`, one is `Trial` and one is `Open`. Several
records say their database and browser tests first ran in CI. The coverage and journey report is
[`reviews/coverage-v4.md`](reviews/coverage-v4.md) (W5-C) and, for plan v5,
[`reviews/coverage-v5.md`](reviews/coverage-v5.md) (R3) — whose own finding, that the production
package never reached its F-G2 gate, is closed (decision 0122).
Nothing here says a launch gate has passed; the gate is the sign-up switch checklist, which the owner
signs.

### `open-decisions-2026-10-15.md` — resolved

Earlier versions of this list said `docs/owner/open-decisions-2026-10-15.md` was named by the
questionnaire for items P1 to P17 and A5 but was "not in this repository", and asked for it to be found
or restored.

**It was never in this repository** — no commit on any branch has ever held a file of that name — and
nothing is missing, because both halves of its content are here:

- **P1 to P17** are the table in **`plans/production-outputs.md`, section 7, "Owner input, and how work
  proceeds without it"**, one row each with what the platform does until the owner answers.
  `apps/web/lib/techpack/production/owner-inputs.ts` reads that section and is the code that shows them
  on the "Ready for the factory" list. They are reproduced, with their v5 cross-references, as group P of
  [`owner/open-questions-v5.md`](owner/open-questions-v5.md#p-the-2026-10-15-items-p1-to-p17-recovered).
- **A5** is **`docs/owner/size-charts.md`**, "Owner action A5: size charts for every garment family",
  with `docs/owner/size-chart-template.csv` to fill in.

Nothing below depends on a file being found.

---

## 1. Built in this repository

| Area | What exists | Record |
|---|---|---|
| Accounts and isolation | Sign-up switch (closed), brands, roles, row level security, file quota 500 MB a brand, erasure | 0003, 0004, 0023 |
| **The base article catalogue** | `base_articles` with POMs (grades and tolerances), parameter ranges, option codes, allowed fabrics and construction, for 8 launch articles. **Only `JSY-SS-01` publishes any measurement**; the other seven hold a drafted brief and nothing else | 0066, 0090 |
| **The rulebook and "Why?"** | Versioned `rulebook_entries` with sources, a "Why?" link on every rule, and `R-GAP-000` for a check with no entry. All of `JSY-SS-01`'s and 28 draft rows for the other seven; none confirmed by a factory | 0067, 0090 |
| **The graded parametric drafter** | Pattern pieces for every size of `JSY-SS-01` from its article and form, byte-identical to the committed reference pack; every number is a labelled, sourced `draft_constants` entry. The other seven answer "not drafted yet" | 0068 |
| **Design object v2 and validation** | Validation on every save against the article's own approved options and ranges, with a rule id on every finding; the catalogue and moderation ports wired | 0069 |
| **The production package and the files-service seam** | The whole folder a factory receives — tech pack, 1:1 print files per piece per size, pattern DXF, bill of materials, labels, quality plan — behind one gate; the heavy half behind an interface | 0070, 0101 |
| **The factory model as data** | `factories`, `factory_capabilities`, `price_tiers`, `programme_fabrics`, `country_rules`: lead times, MOQ, tiers, colour tolerance, VAT. Every value a labelled placeholder; **QC days and freight days deliberately unset, so no delivery date is shown anywhere** | 0071 |
| **The factory job packet** | One tokenised link per batch, sent by WhatsApp or copied by ops, opening `job/[token]`: pieces, sizes, names, BOM, files, never a price. The factory never logs in | 0072 |
| **Moderation and IP** | Picture and text screening, a reviewer queue at `/ops/review`, a report form, the Class B human-review block | 0073 |
| **The Studio shell** | Studio home, create-new modal, catalogue, and the editor shell with its **seven panel slots** and the contract that makes an invalid result impossible (`lib/editor/slots.ts`) | 0074, 0075 |
| **The editor panels** | 2D pattern view and Library, Specs toolbar and tech pack view, the 16-page PDF and the Export panel, names and numbers, the repeat maker, Share | 0076 to 0078, 0081 |
| **Brand Studio** | Typed by hand (Y6) and imported from a URL (L7): colours, fonts, voice, logos, completion. **No Pantone data ships**, so nothing is ever matched | 0079, 0102 |
| **Make** | Product created, sample orders, golden samples signed off against a version, the order modal. A run is refused without an approved golden sample | 0080 |
| **Inspire and intelligence** | The inspiration board, Ask with citations over the rulebook, benchmarks that never copy a competitor, the collection and line plan | 0082 to 0085 |
| **Teamwear** | The configurator, crest-to-kit with the quote PDF, committee link v2 with named approvals, roster sign-up by link | 0086, 0087, 0105 |
| **Compliance** | **One** F-G2 pre-export checklist read through three adapters (Review tab, package, ordering); labels per market printed only from a sourced row; PFAS-free only; OEKO-TEX only where a fabric holds one; US and youth sizes blocked until CPSIA testing exists; the AQL table | 0089 |
| **The Launch surface** | The canvas shell with its boards and its **eighteen panel slots** (`lib/launch/panels.ts`), deterministic mockups, AI scenes with the garment locked, the marketing studio, the video studio, flows, 60 design templates and 15 kit bundles | 0091 to 0096, 0098, 0108 |
| **Ops, complete** | Batches cut by a cron route at the cut-off, the factory sheet, status, the AQL table, typed ΔE readings, third-party inspection (stubbed), packing, shipping, exceptions, the commercial invoice, customer status emails, the per-factory scorecard, pattern requests | 0043, 0050, 0060, 0100 |
| **The Store contract v2** | A read-only payload of published products, media, sizes, tier prices in GBP and AUD, delivery dates, personalisation rules and size charts, under `app/api/store/**`, behind a signed service token | 0106 |
| **Australia and Translate** | AU country rules, the GST trigger as data, Australia's label rules, the Australian starters, and the tech pack in Urdu (Noto Naskh Arabic under the OFL, right to left). **Every AUD price is null** | 0104 |
| Factory files (earlier) | Validation gate, print files, pattern library, fabrics, releases, sign-offs | 0028 to 0033, 0039 |
| Images and 3D | Photoreal images as jobs, media sets, lifestyle, clips, picture checker, 3D trial (off behind `SHOW_3D`) | 0014, 0018, 0054 to 0059 |
| Credits | Ledger, gate behind `CREDITS_ENFORCED` (off) | 0044, 0051 |
| Settings | Console at `/admin/settings` for credits, the cut-off, the checks, the factory terms | 0056, 0071 |
| Phone and accessibility | Phone layout pass; the studio top bar reworked to four pills and an overflow menu | 0064, 0103 |
| Legal text | Terms, privacy notice, data processing in `docs/legal/`, **as drafts** | 0023, 0025 |
| CI | Secret scan, invariants, audit, typecheck, lint, coverage, build; browser tests on `main` and on an `e2e`-labelled pull request | `.github/workflows/ci.yml` |

## 2. Waits for the owner

Nothing here blocks the build. Each item replaces a labelled placeholder.

**The full list is [`owner/open-questions-v5.md`](owner/open-questions-v5.md)** — 269 questions grouped
by what kind of answer each needs. What follows is only what bears on opening sign-up.

### The six that stop a real order

Set out in full, with the evidence for each, at the top of [`owner/README.md`](owner/README.md).

- [ ] **A licensed copy of ISO 3758**, its care symbols transcribed, and a name against them. Until then
      no label prints for any market and the production package is refused for every market
- [ ] **An AUD price ladder.** `sell_aud_minor` is null on all three tiers
- [ ] **QC-and-packing days and freight days.** Both unset, so no delivery date is shown anywhere
- [ ] **A decision on Pantone.** No Pantone data ships and no Pantone number is given anywhere
- [ ] **The factory's data for the seven other base articles**: pattern, size chart, POM table with
      grades *and* tolerances, construction, seam allowances, thread, and each fabric's real code,
      weight and blend
- [ ] **The hosted deployment**, which is entirely owner actions (below)

### Do first (the money and the dates)

- [ ] Q1 credit prices, and then whether to set `CREDITS_ENFORCED=true`. **Set it on purpose in
      production, either way**: while it is unset, unlock and every credit-gated output are free, and the
      server logs a warning at start (security review L5)
- [ ] Q4 / 23 price ladder and minimum order per article (from the factories, in writing)
- [ ] Q6 weekly batch cut-off, and whether `/ops/settings`' UTC cut-off is retired in favour of the
      factory's own clock so there is one cut-off, not two
- [ ] Q7 factory per article
- [ ] Q13 bleed and safe zone (10 mm and 15 mm disagree today)
- [ ] Q17 / 28 print house colour profile, and 26 the colour house's white point and observer
- [ ] Q22 whether there is a 1-to-9 price or the real minimum is ten pieces
- [ ] Q24 couriers; Q25 acceptable defect rate
- [ ] Q31 approval of the 200 intake prompts; Q36 the pattern technician
- [ ] 46 QC and freight days; 47 the real Class B quantity range; 90 what an AI mood image is worth

### Before sign-up opens ([`launch/sign-up-switch.md`](launch/sign-up-switch.md))

- [ ] A9 legal review of the terms, privacy notice and data-processing terms; set each document's
      `status` to `"approved"` in `apps/web/lib/legal/` and regenerate with
      `pnpm --filter web exec tsx scripts/write-legal-docs.mts`
- [ ] No Critical or High finding open in the security reports
- [ ] The evidence table read by the owner, with the date and initials
- [ ] A load run against the deployment, recorded in [`launch/evidence.md`](launch/evidence.md)
- [ ] Vercel on Pro with Node 22 or 24 (A2); email sending set up (A4); AI keys with spend limits in each
      provider's console (A3)
- [ ] Turnstile with real keys (a deploy refuses the test keys)
- [ ] `MONITORING_DSN` set to an EU Sentry project, and one test error seen to arrive
- [ ] A destination for the spend alert that the owner watches
- [ ] **The "Before user created" hook switched on in the hosted Supabase project.** Without it anyone
      can register, whatever the switch says. Check it first
- [ ] Owner approval to open, with name and date

### Owed evidence

- [ ] M1 timed runs by a non-technical person ([`reviews/guided-flow-timed-runs.md`](reviews/guided-flow-timed-runs.md))
- [ ] M2 golden set approval (A7), test images (A8), live run with real keys (A3)
- [ ] M6 allowance amounts and a load run
- [ ] The deployed check of the PDF renderer (decisions 0008, 0011) and of the function time limit (0002)
- [ ] Database, end-to-end and browser runs that several decision records say first ran in CI
- [ ] The plan-v5 review reports: `reviews/security-v5.md` (R1) and `reviews/coverage-v5.md` (R3).
      R2's [`reviews/code-v5.md`](reviews/code-v5.md) has landed (decision 0112)
- [ ] The benchmark reader's accuracy against a real key: the 90%-of-`observed` acceptance test needs a
      measurement run outside CI (decision 0084 question 6). *Crest-to-kit's own acceptance test — 95 of
      100 crests within ΔE00 < 5 — is **not** owed: it runs in CI against generated fixtures
      (`lib/crest-to-kit/fixtures.test.ts`).*
- [ ] Acceptance of the 71 records whose status is still `Proposed`

### Other owner decisions still open

- [ ] Everything in [`owner/open-questions-v5.md`](owner/open-questions-v5.md) not named above — groups
      A to F and P
- [ ] Q2, Q3, Q5, Q8, Q10 to Q12, Q14 to Q16, Q18 to Q21, Q23, Q26 to Q30, Q32 to Q35, Q37 to Q48 of the
      2026-10-25 sheet
- [ ] 3D verdict (A10) and the launch garment list (decision 0027)
- [ ] Who cuts batches and when: a cron route cuts them at the cut-off setting now, and a button remains
      (decision 0043, 0100)

### Known gaps to decide on — checked on 2026-11-02

Each of these was opened and read. Three are unchanged, one has changed.

- **Still true, and it now matters more.** The guardrail settings saved in the console do not change the
  editor checks. `lib/settings/read.ts` exports `loadGuardrailSettings` and **nothing outside
  `lib/settings` calls it** — its only caller in the repository is its own test (decision 0056, "Honest
  limits"). Until 2026-11-03 this was a console that did nothing; since the clear space was reseeded from
  `R-SUB-004` to 15 mm (decision 0125) it is also the only way a league could ask for a different figure,
  and that way does not work. Wiring it means loading the value on the server and threading it into
  `layerChecks` and `guardrailInputOf`, across a client boundary — not a one-line change, which is why
  0056 left it and 0125 records the correction rather than claiming the override works.
- **Still true.** A per-brand daily cap on paid media generation is stored and nothing reads it. The key
  is `media.daily_cap_per_brand` (`lib/settings/registry.ts`); its only other appearances are in that
  file's own test. *(Earlier versions of this list called it "Media sets per brand per day", which is not
  the key's name.)*
- **Still true.** Nothing refunds credits on order. `orderDesignVersion` is defined in
  `lib/credits-gate/server.ts` and has no caller anywhere.
- **Changed: the platform now sends two kinds of email.** Earlier versions said "No email is sent by the
  platform: no invitation, no lead notice, no factory sheet." Two of those three are now built, behind
  keys:
  - **share and design invitations** go through Resend
    (`SHARE_EMAIL_PROVIDER`, `SHARE_EMAIL_KEY`, `SHARE_EMAIL_FROM`, `lib/share/email-server.ts`,
    decision 0081). Without all three, nothing is sent and the member is shown the link to send
    themselves;
  - **customer status emails** go through Resend
    (`OPS_EMAIL_PROVIDER`, `OPS_EMAIL_KEY`, `OPS_EMAIL_FROM`, `lib/ops/notify/`, decision 0100). A record
    of what was sent, or of why nothing was, is kept either way.

  Still true: **no lead notice is emailed** — `lib/leads/notify.ts` writes one info line to the server
  log, naming ids and numbers only. And **the factory sheet is not emailed**: the factory gets a
  tokenised link by WhatsApp or copied by ops (decision 0072).
- **New.** `lib/compliance` owns no route, no page and no component: the one pre-export checklist is
  called by the tech pack's Review tab, the package and the hand-off through adapters the orchestrator
  wires, and `lib/kpp/gate.ts`'s older copy of the same list has not been deleted yet. The handover is
  the parity test in `lib/compliance/from-package.test.ts` (decision 0089 section 1).
- **New.** The brand-import screen's engine and view model are done and the panel, the route and the
  stage-by-stage progress have no component path (decision 0102 question 1).
- **New.** No `brand_import_runs` table, so a minute-long brand import loses its proposal on a reload,
  and the import screen cannot keep a picture (decisions 0102 question 2, 0108 question 2).

## 3. Outside this repository

These are the Store and Sell storefronts and the host. This repository does not build, and must not
build, any of them.

- [ ] The Store: cart, checkout, payment, prices, order confirmation emails
- [ ] The Store's two doors into the platform: `submit_order_for_production` (decision 0043) and the
      read side specified in [`store-contract-v2.md`](store-contract-v2.md) (decision 0106)
- [ ] Selling credits (Q1: "Selling credits is the Store's job")
- [ ] Team-store links and club sites
- [ ] Hosting: the Vercel login and project, the hosted Supabase project, Resend, Google sign-in, the
      Turnstile widget, the EU Sentry project ([`runbooks/supabase-hosted.md`](runbooks/supabase-hosted.md))
- [ ] The partner relationships: the Australian partner's size table and test photos, the Sialkot
      factories' quotes, patterns and marker, the print house's colour profile, the colour house's white
      point
- [ ] The paid standards and licences: ISO 3758, ISO 2859-1, Pantone TCX, kit fonts, a CMYK profile, AI
      model licences — group C of [`owner/open-questions-v5.md`](owner/open-questions-v5.md)
- [ ] Sample orders through a real factory before the first public order, and a golden sample signed off
      per article
