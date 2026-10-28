# Launch checklist

The one list to read before sign-up opens. It gathers what is built, what waits for the owner and what lives outside this
repository. It does not replace the detail:

- The sign-up switch and its "Before opening" list: `docs/launch/sign-up-switch.md`
- Acceptance criteria M1 to M7: `docs/launch/evidence.md`
- Security findings: `docs/launch/security-review.md` and `docs/reviews/security-v4.md` (written by workstream W5-A)
- Dependency licences: `docs/launch/licences.md`
- Hosted setup: `docs/runbooks/supabase-hosted.md`
- Owner questions with suggested answers: `docs/owner/questionnaire-2026-10-25.md`

**Where this list is weaker than the sources.** Items marked "built" mean the code and its tests exist and the decision record
says so. A decision with status "Proposed" has not been accepted by the orchestrator or owner yet
(`docs/decisions/README.md`). Several records say their database and browser tests first ran in CI. The coverage and
journey report is `docs/reviews/coverage-v4.md` (W5-C). Nothing here says a launch gate has passed; the gate is
the sign-up switch checklist, which the owner signs.

`docs/owner/open-decisions-2026-10-15.md` is named by the questionnaire (P1 to P17 and A5) but is **not in this repository** at the
time of writing. Its content could not be read for this list. Ask for it, or restore it, before treating the owner section below
as complete.

## 1. Built in this repository

| Area | What exists | Record |
|---|---|---|
| Accounts and isolation | Sign-up switch (closed), brands, roles, row level security, file quota 500 MB a brand, erasure | 0003, 0004, 0023 |
| Design and tech pack | Garment registry for tops, bottoms, outerwear, close-fitting; flats; tech pack; PDF, Excel and SVG exports | 0005 to 0011, 0016, 0017, 0021 |
| Assistant | Text and sketch input, golden test set (not approved), guided flow | 0013, 0019 to 0022, 0046 |
| Images and 3D | Photoreal images as jobs, media sets, lifestyle, clips, picture checker, 3D trial (off) | 0014, 0018, 0054 to 0059 |
| Factory files | Validation gate, print files, pattern library, fabrics, releases, sign-offs | 0028 to 0033, 0039 |
| Clubs | Club workspace, rosters, seasons, templates, two-click reorder | 0041, 0042, 0052, 0065 |
| Brands | Product list, brand runs, designer templates and royalty ledger | 0061, 0062 |
| Collaboration | Share links, design comments | 0026, 0063 |
| Ops | Batches, factory sheet, status, QC, packing, shipping, exceptions, metrics, pattern requests | 0043, 0050, 0060 |
| Credits | Ledger, gate behind `CREDITS_ENFORCED` (off) | 0044, 0051 |
| Settings | Console at `/admin/settings` for credits, cut-off, checks, factory terms | 0056 |
| Phone and accessibility | Phone layout pass | 0064 |
| Legal text | Terms, privacy, data processing in `docs/legal/` as drafts | 0023, 0025 |
| CI | Secret scan, invariants, audit, typecheck, lint, coverage, build, end-to-end | `.github/workflows/ci.yml` |

## 2. Waits for the owner

Nothing here blocks the build. Each item replaces a labelled placeholder. Question numbers are from the questionnaire.

### Do first (questionnaire)

- [ ] Q1 credit prices, and then whether to set `CREDITS_ENFORCED=true`. Set it on purpose in production, either way: while it is unset, unlock and every credit-gated output are free, and the server logs a warning at start (security review L5)
- [ ] Q4 price ladder and minimum order per article (from the factories, in writing)
- [ ] Q6 weekly batch cut-off (and its time zone, UTC in the console)
- [ ] Q7 factory per article
- [ ] Q9 Australian winter code
- [ ] Q13 bleed (10 mm and 15 mm disagree today)
- [ ] Q17 print house colour profile
- [ ] Q20 Fabric.js for panel layers
- [ ] Q24 couriers
- [ ] Q25 acceptable defect rate
- [ ] Q31 approval of the 200 intake prompts
- [ ] Q36 the pattern technician

### Before sign-up opens (`docs/launch/sign-up-switch.md`)

- [ ] A9 legal review of the terms, privacy notice and data-processing terms; set each document's status to `"approved"` and
      regenerate with `pnpm --filter web exec tsx scripts/write-legal-docs.mts`
- [ ] No Critical or High finding open in the security reports
- [ ] The evidence table read by the owner, with the date and initials
- [ ] A load run against the deployment, recorded in `docs/launch/evidence.md`
- [ ] Vercel on Pro with Node 22 or 24 (A2); email sending set up (A4); AI keys with spend limits in each console (A3)
- [ ] Turnstile with real keys (a deploy refuses the test keys)
- [ ] `MONITORING_DSN` set to an EU Sentry project, and one test error seen to arrive
- [ ] A destination for the spend alert that the owner watches
- [ ] The "Before user created" hook switched on in the hosted Supabase project (without it anyone can register)
- [ ] Owner approval to open, with name and date

### Owed evidence

- [ ] M1 timed runs by a non-technical person (`docs/reviews/guided-flow-timed-runs.md`)
- [ ] M2 golden set approval (A7), test images (A8), live run with real keys (A3)
- [ ] M6 allowance amounts and a load run
- [ ] The deployed check of the PDF renderer (decisions 0008, 0011) and of the function time limit (0002)
- [ ] Database, end-to-end and browser runs that several decision records say first ran in CI

### Other owner decisions still open

- [ ] Q2, Q3, Q5, Q8, Q10 to Q12, Q14 to Q16, Q18, Q19, Q21 to Q23, Q26 to Q30, Q32 to Q35, Q37 to Q48
- [ ] 3D verdict (A10) and the launch garment list (decision 0027)
- [ ] Whether `/ops/settings` is removed in favour of the console, and whether the cut-off takes a time zone (decision 0056)
- [ ] Who cuts batches and when: a button today (decision 0043, O4)
- [ ] Items P1 to P17 and A5 from `docs/owner/open-decisions-2026-10-15.md`, once that file is found

### Known gaps to decide on

- The guardrail settings saved in the console do not change the editor checks yet (decision 0056, "Honest limits").
- "Media sets per brand per day" is stored but no code reads it.
- Nothing refunds credits on order yet (`orderDesignVersion` has no caller).
- No email is sent by the platform: no invitation, no lead notice, no factory sheet.

## 3. Outside this repository

These are the Store and Sell storefronts and the host. This repository does not build, and must not build, any of them.

- [ ] The Store: cart, checkout, payment, prices, order confirmation emails
- [ ] The Store's call to `submit_order_for_production` and its fields (questionnaire 39; decision 0043)
- [ ] Selling credits (Q1: "Selling credits is the Store's job")
- [ ] Team-store links and club sites
- [ ] Hosting: the Vercel login and project, the hosted Supabase project, Resend, Google sign-in, the Turnstile widget
      (`docs/runbooks/supabase-hosted.md`)
- [ ] The partner relationships: the Australian partner's size table and test photos, the Sialkot factories' quotes and patterns,
      the print house's colour profile
- [ ] Sample orders through a real factory before the first public order
