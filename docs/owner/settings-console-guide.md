# The settings console: a guide for the owner

This is a guide to the settings screen at `/admin/settings`, and a table that says where each answer to
`docs/owner/questionnaire-2026-10-25.md` goes. It was written from the code in `apps/web/lib/settings/` (decision
`docs/decisions/0056-platform-settings-console.md`).

**The answers are still pending.** Nothing below is an answer. Every "default" is what the platform does today
while nobody has answered, and most are labelled placeholders on screen. Write your answers in the questionnaire; a
platform admin then enters them here.

## Who can open it

Only a platform admin. Everyone else, signed in or not, gets the "page not found" page. Platform admins are added
by hand in the database (the `platform_admins` table); there is no screen for that (decision 0024). The same people can
open the ops console at `/ops`.

## How it works

- The page lists every setting in groups. Each has a plain label, one line of help, a **Save** button and a **Use the
  Knitwright default** button.
- Under each setting a line says where the value comes from: "Set by <address> on <date>", or "Knitwright default, not
  agreed with a factory". It also names the questionnaire question the setting answers.
- A **History** list under a setting shows its last five changes: the day, the new value, and who changed it.
  The full record cannot be edited or deleted, even by the server.
- A wrong value is refused with a sentence that says why ("Whole numbers only", "Use 0 or more").
- A saved value takes effect without a deploy.
- **Times are UTC.** There is no time zone field. Pakistan time is five hours ahead of UTC, so 12:00 in Pakistan is
  07:00 UTC.
- **Do not type keys or passwords.** The screen is not for secrets, and a test fails if a setting is ever added for one.
  Provider keys live in the host's environment variables (see `README.md`).

## Every setting

Groups appear on the page in this order: Credits, Weekly batch, Print file checks, Marketing media, Picture checker,
Factory terms, Designer royalties. The "Picture checker" group is declared but has no settings yet, so the page does not
show it.

### Credits

| Setting | Default today | What it changes |
|---|---|---|
| Credits for marketing media | 1 | What one media set costs a brand, in credits. 0 makes it free. |
| Credits for techpack pdf | 1 | What the full tech pack PDF costs. |
| Credits for pattern file | 1 | What a set of pattern files costs. |
| Free credits each month | 10 | Granted to every brand at the start of each UTC month. Does not roll over. |
| Pattern service: credits per request | Not set | What a brand pays to send a design to the Sialkot team for a pattern. While empty, nothing is charged and the brand is told Knitwright will confirm the price. |

Notes:

- A price of 1 is a placeholder and the credits page says so. The prices stop being marked as placeholders only once all
  three are set here.
- **Nothing is charged yet.** Charging is switched on by the host setting `CREDITS_ENFORCED=true`, which is off by
  default (decision 0051). With it off, the platform only writes to the log what each output would have cost. Setting prices here
  does not turn charging on.
- Credits spent on a design come back once when it is ordered. That rule is in code, not a setting, and nothing in the app
  calls it yet because the order flow lives in the Store (decision 0051, point 7).

### Weekly batch

| Setting | Default today | What it changes |
|---|---|---|
| Weekly batch cut-off: day | Friday | The day the weekly batch closes. Stored as a weekday number, 0 is Sunday. |
| Weekly batch cut-off: time (UTC) | 17:00 UTC | Stored as minutes after midnight UTC. 12:00 Pakistan time is 07:00 UTC, which is 420. |
| Days from the cut-off to the promised date | Not set | The promised date of an order is its cut-off date plus this. While empty, no order gets a promised date. Orders already submitted keep theirs. |
| Pattern service: working days to deliver | Not set | Shown to a brand that asks for a pattern. While empty, no turnaround is promised. |

Notes:

- Saving any of the first three rewrites the ops settings row (`ops_settings`), so the older form at `/ops/settings` shows the
  same values. A lead time typed only there is replaced by the default the next time any weekly batch setting is saved here
  (decision 0056, "Honest limits").
- The cut-off is a day and a time. Which orders fall in which batch is worked out when someone presses **Cut batches now**
  in the ops console. Nothing cuts batches by itself.

### Print file checks

| Setting | Default today | What it changes |
|---|---|---|
| Smallest picture resolution (dpi at print size) | 150 | Artwork below this is flagged. |
| Bleed (mm) | 10 | How far artwork runs past the cut line. |
| Clear space around names and numbers (mm) | 10 | Distance kept from seams and edges. |

**Read this before relying on these three.** The editor checks that read them (`lib/variants/generate.ts`,
`lib/panel-layers/guardrail-input.ts`) still use the built-in values. The loader for stored values exists
(`loadGuardrailSettings`) but no screen or check calls it yet. A value saved here is recorded and shown, and does not yet
change a check. Also, two defaults disagree today: the editor checks use a 10 mm bleed, and the print file profile
(`lib/print/profiles/schemas.ts`) uses 15 mm. Question 13 asks you to pick one.

### Marketing media

| Setting | Default today | What it changes |
|---|---|---|
| Media sets per brand per day | Not set | Meant to cap paid media generations per brand per UTC day; 0 stops them. **No code reads it yet.** It is stored and shown only. The money caps in `.env` (`USAGE_*`, `LIFESTYLE_DAILY_CAP_MICRODOLLARS`) are what limit spend today. |

### Factory terms

These are written into the default factory profile, which the "Ready for the factory" check and the tech pack read.
Until a value is set, the profile says "not set" and the platform does not invent one.

| Setting | Default today | What it changes |
|---|---|---|
| Minimum order per article | Nothing set | One line per article, such as `crew-tee = 10`. An article not listed has no minimum. |
| Price ladder | Not set | One line per step, `pieces = unit price`, such as `10 = 32.50`. Use the factory's written quote only. |
| Factory lead time (working days) | Not set | Production days the factory has agreed in writing. This is separate from the ops lead time above. |
| File formats the factory accepts | Empty | Separated by commas, such as `pdf, dxf, png`. |
| Customs (HS) codes per article | Nothing set | One line per article, such as `crew-tee = 6109.10`. |

### Designer royalties

| Setting | Default today | What it changes |
|---|---|---|
| Designer royalty per unit | Not set | What a designer is credited for each piece ordered from their template, in the smallest unit of the order's currency (cents for AUD). While empty, nothing accrues and units are still counted. The platform pays nothing out. |

### Picture checker (not on the page yet)

The generated-image checker (decision 0055) has six thresholds, such as the largest colour difference allowed between a
reference and a generated picture. They are defaults in code (`lib/media-check/settings.ts`, labelled "Knitwright default, not
tested against real generations") and are not yet registered as settings.

## Where each questionnaire answer goes

"Console" means a setting above. "Code" means the value lives in the code, so a developer changes it; the owner writes the
answer in the questionnaire as usual. "Process" means no software change: the answer is a decision or a request to
someone. The default column says what happens now.

| Q | Question in short | Where the answer goes | Default today |
|---|---|---|---|
| 1 | Credit prices | Console: the three "Credits for ..." settings and "Pattern service: credits per request". Charging itself is the host variable `CREDITS_ENFORCED`. | 1, 1 and 1; pattern service not set |
| 2 | Refund credits when ordered | Code: `refundForOrder` in `lib/credits/service.ts`, called from `lib/credits-gate/order.ts` | Refunded once per spend on that design version; not called by any screen yet |
| 3 | Free credits a month, rollover | Console: "Free credits each month". Rollover is code. | 10, no rollover |
| 4 | Minimum order and price ladder | Console: "Minimum order per article", "Price ladder", "Customs (HS) codes per article" | Not set; no price is shown anywhere |
| 5 | Lead time | Console: "Days from the cut-off to the promised date" and "Factory lead time (working days)" | Not set; no promised date |
| 6 | Batch cut-off | Console: "Weekly batch cut-off: day" and "time (UTC)" | Friday 17:00 UTC |
| 7 | Factory per article, fabric | Console: "File formats the factory accepts" only. The factory and fabric of an order are passed by the Store as text ids (decision 0043); there is no per-article factory table. | Formats empty; one default factory profile |
| 8 | Swatch book and colour tolerance | Process. No setting or code holds it. The only colour tolerance in code is for generated pictures (`lib/media-check/settings.ts`) and is not about printed colour. | No colour accuracy is claimed anywhere |
| 9 | Australian winter code | Code: `lib/garment/registry/teamwear` and `lib/config/launch-garments.ts` | An empty slot "Team top, winter code" |
| 10 | Socks and caps | Code: `lib/config/launch-garments.ts` is the only switch for what can be picked | Not in the launch list |
| 11 | Patterns for articles with no drafter | Process, then the pattern library (`lib/pattern-library`, an admin loads the files). Pattern service price and days are in the console. | "No pattern yet" |
| 12 | Australian sizes and labels | Code and data: starter charts in `lib/sizing`; a brand's own chart is imported from a spreadsheet (`docs/owner/size-chart-template.csv`) | Starter charts marked as suggested |
| 13 | Bleed | Console: "Bleed (mm)" (the stored value is not read by checks yet). Print profile default 15 mm is code: `lib/print/profiles/schemas.ts`. | Editor checks 10 mm, print profile 15 mm |
| 14 | Minimum resolution | Console: "Smallest picture resolution". One level only; a separate warn and block level is code. | 150 dpi, a warning |
| 15 | Clear space for names and numbers | Console: "Clear space around names and numbers (mm)" (not read by checks yet). League rules are not in the platform. | 10 mm |
| 16 | Artwork over a seam | Code: `lib/guardrails/seam-cross.ts` | A warning only |
| 17 | Print house colour profile | Process, then a file on the print profile (`iccFileId`). The gamut check is code: `lib/guardrails/gamut.ts`. | An estimate, labelled as one; no profile |
| 18 | Fonts for names and numbers | Code: bundled font files | One font (Geist) |
| 19 | Pantone | Code. No Pantone data exists. | Hex and a factory colour code |
| 20 | Fabric.js for panel layers | Process: read `docs/decisions/0053-panel-layer-editor.md`. A flagged prototype exists; the real editor is unchanged. | Not adopted |
| 21 | Text on a path | Code, future (a new artwork version) | Not built |
| 22 | Raster logos to vectors | Code, future | Not built |
| 23 | Number of inspiration variants | Code: `PANEL_COUNT` in `lib/variants/apply.ts` | 10 |
| 24 | Couriers | Code: `lib/ops/shipping/provider.ts` (only a manual provider) | Courier and tracking number typed by hand |
| 25 | Defect rate that fails QC | Code: `lib/ops/qc/checklist.ts` (`DEFECT_RULE_LABEL`) | Zero: one defective piece fails the order |
| 26 | Points of measure and tolerance | Code, then the QC form. Today the inspector types them on each line. | Typed on every line |
| 27 | How remakes reach the factory | Process, plus code to print them on the next factory sheet | A remake line on screen only |
| 28 | Tracking visible to clubs, `shipped` status | Code (a policy and a screen; `shipped` is derived, `fulfilmentOf` in `lib/ops/shipping/rules.ts`) | Clubs do not see tracking |
| 29 | Packing rules | Code: the default text on the factory sheet (`lib/ops/factory-sheet`) and the packing form | A labelled default text |
| 30 | How the factory gets the batch sheet | Process. Nothing is sent by the platform. | A person downloads it from the batch page |
| 31 | Approve the 200 intake prompts | Code and data: the cases in `lib/intent/golden` carry an `approved` flag | All `approved: false` |
| 32 | The 95% target | Process, then `docs/decisions/0046-intake-evaluation.md` | No live run has been made |
| 33 | Test model and spend limit | Code: `lib/intent/golden/live-eval.ts` (the run); the model is the host variable `INTENT_MODEL` | No live run has been made |
| 34 | Jersey photos for the picture test | Process: files go in `apps/web/lib/intent/golden/images` (see its `README.md`) | None |
| 35 | Design from a picture: wording and price cap | Console: "Media sets per brand per day" is registered against this question but no code reads it. Wording is `docs/data-processing.md`. | Off |
| 36 | Pattern technician | Process. A name and date are typed against each pattern (library review, and "Record the review" on a pattern request). | Every pattern says "Draft pattern, not reviewed" |
| 37 | Fabric test values from the mill | Data: the fabric library at `/brands/fabrics` (`lib/fabrics`) | Not set; print scale 1.0 |
| 38 | Who signs what | Code: `SIGN_OFF_ROLES` in `lib/proofs/types.ts` | Any member signs with a role they type |
| 39 | Does the Store use `submit_order_for_production` | Process: give the Store's author `docs/decisions/0043-ops-console-batches.md` | Nothing calls it from the app |
| 40 | Who can add templates | Code and process: templates page `/admin/templates` is for platform admins; designers' submissions are decision 0061 | Platform admins only |
| 41 | The first reviewed templates | Process, then data | Starter templates labelled as not reviewed by a factory |
| 42 | When designers submit templates | Console: "Designer royalty per unit" holds the rate. The on and off switch is code. | Rate not set; nothing accrues |
| 43 | Templates use the club's colours | Code: `lib/clubs/apply-kit.ts` puts the club kit on a design as a "Club colours" colourway. A "use club colours" switch is not in the code. | Applied when a person applies the kit |
| 44 | Kit patterns for football and cricket | Code: `lib/kit-styles` | Not built |
| 45 | Roster: date of birth or age group | Code: `lib/clubs/roster.ts` and `schemas.ts`. Neither holds a date of birth field today. | No date of birth |
| 46 | Club roles | Code: `lib/clubs/roles.ts` (the database enforces the same roles) | A kit manager cannot change members; a viewer can look and change nothing |
| 47 | Invitation email provider | Process, then host variables. No mailer is built. | None |
| 48 | When small brands get the product list | Process. The brand workspace and brand runs are built (decision 0062). | Built |

Rows 41, 44 and 47 describe the default from the questionnaire's own "Today" line and the decision records, not from a
line of code this guide traced. Read the file named before you rely on it.

## After you answer

1. Write each answer in the questionnaire, in the "Your answer" line.
2. A platform admin opens `/admin/settings`, finds the setting, types the value and presses **Save**. The source line then
   reads "Set by <address> on <date>".
3. For a "Code" row, a developer changes the default and the decision record's owner questions section.
4. To undo a value, press **Use the Knitwright default**. The platform goes back to the placeholder and the history keeps
   both steps.
