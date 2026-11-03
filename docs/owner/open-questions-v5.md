# The open owner questions, collected

Every question the thirty v5 workstreams left for the owner, in one list. Each one was written by the
workstream that hit it, in its decision record; this file gathers them so the shape of them can be
seen at once, and **groups them by what kind of answer each needs**, because the answers come from
different places and most of them can be chased in parallel.

Written 2026-11-02 by the documentation pass (R4, decision 0115) and extended 2026-11-03 with the
eighteen questions the reviews and the wiring that followed them raised (decisions 0116, 0117, 0122,
0123 and 0124) — group E's last subsection. The decision records are authoritative: this file is an
index into them, one line per question, with the record cited. Where a record states what the platform
does while the question is open, that sentence is in the record.

**Three have been answered since, and are not in the list.** The clear space around a name is
`R-SUB-004`'s 15 mm rather than a 10 mm default of ours (plan question 93, decision 0125); the
best-practice card is reached from a six-part chooser beside the Ask box (0117 q1, decision 0126); and
the editor's toolbar toggle stays upright (0117 q6, decision 0126).

**Nothing here blocks the build.** Every one of these is already live behind a labelled default, and
no page states a fact nobody has agreed; it names what is missing instead. Six of them do block a
real order, and they are marked ⛔ and listed first.

**How to use this.** The groups are the shortest path: one session with the Sialkot partner answers
most of group B, one licence purchase answers most of C, one call with a lawyer answers most of D.
Group E is Knitwright's own product decisions and can wait. Answer in
[`questionnaire-2026-10-30.md`](questionnaire-2026-10-30.md) (plan-v5 decisions 21 onward) and
[`questionnaire-2026-10-25.md`](questionnaire-2026-10-25.md) (plan-v4 questions 1 to 48) where the
question already appears there; otherwise answer against the record cited here.

## The groups

**270 questions**: 235 from the v5 decision records, the 18 the reviews and the wiring after them raised, and the 17 items of 2026-10-15 recovered in group P.

| Group | What kind of answer it needs | How many |
|---|---|---|
| [A](#a-money-a-price-or-an-amount-only-you-can-set) | **Money**: a price or an amount only the owner can set | 21 |
| [B](#b-a-factorys-or-a-suppliers-figure) | **A factory's or a supplier's figure**: the Sialkot partner's pattern master, its marker, its quote, the mill, the print house, the colour house | 59 |
| [C](#c-a-licence-a-purchase-or-an-account) | **A licence, a purchase or an account**: a paid standard, a colour library, a font, a model's terms, an API tier | 20 |
| [D](#d-a-lawyer-or-an-adviser) | **A lawyer or an adviser**: a legal position, a customs position, a copyright opinion, a retention rule | 17 |
| [E](#e-a-product-decision-yours-alone) | **A product decision**: what Knitwright wants the platform to do | 130 |
| [F](#f-a-name-against-something) | **A name against something**: a person who reads, confirms, reviews, translates or signs | 6 |
| [P](#p-the-2026-10-15-items-p1-to-p17-recovered) | The seventeen items of 2026-10-15, recovered from `plans/production-outputs.md` | 17 |

A question that could sit in two groups is filed under the one that unblocks it. A question asked by
more than one workstream appears once, with every record that asked it.

**Reading a citation.** A bare number is a decision record: "0089 q1" is question 1 of
`../decisions/0089-compliance-and-pre-export.md`. A bare "questionnaire N" is the 2026-10-30 sheet,
whose numbering starts at 21; the 2026-10-25 sheet is always named with its date.

---

## The seven that block a real order

These are the whole of what stands between the platform and a factory order. Four are purchases or
decisions only the owner can make, and no further engineering moves any of them. The seventh is new and
is the opposite shape: it is a decision about how strict to be, and either answer is one line of code.

| | Question | Group | Record |
|---|---|---|---|
| ⛔1 | **Buy a licensed copy of ISO 3758 and transcribe the care symbols**, or get the wording from the factory's own licensed copy, and name who confirms them. Until the `care_symbols` rows have a symbol reference, words **and** a source, no care line prints for any market, so no label prints, so the production package is refused for every market and nothing may be sent to a factory. | C1 | 0089 q1, 0104 q3 |
| ⛔2 | **Set the AUD club price ladder.** `price_tiers.sell_aud_minor` is null on all three tiers; a test asserts no digit appears in an unpriced AUD row, so nothing sells in Australia at a shown price. | A3 | 0104 q1, 0071 q4, 0074 q2 |
| ⛔3 | **Set the QC-and-packing working days and the freight days.** Both are unset (`production.qc_days` deliberately has no default; `country_rules.freight_days` is null), so **no delivery date is shown anywhere** and every page names what is missing instead. | B2, B3 | 0071 q2, q3 |
| ⛔4 | **Decide whether Knitwright licenses Pantone.** No Pantone data ships, so no Pantone number is given anywhere and a wording test enforces that silence. | C2 | 0076 q2, 0079 q3, 0105 q1 |
| ⛔5 | **Get the factory's data for the seven other base articles**: the pattern and size chart, the POM table with grades *and* tolerances, the construction table, seam allowances and thread, and each fabric's real code, weight and blend. Seven of the eight base articles publish no measurement at all, so their tech packs and size charts are refusals. | B30, B31 | 0090 q1, q6 |
| ⛔6 | **Do the hosted deployment**, which is entirely owner actions: the Supabase project and its keys, Resend, Google OAuth, Turnstile, and the legal documents in `docs/legal/` approved with their `status` set before the sign-up switch may open. | — | [`README.md`](README.md), [`../launch/sign-up-switch.md`](../launch/sign-up-switch.md) |
| ⛔7 | **Decide whether an unscreened picture blocks "Ready for the factory", or only warns.** It blocks today (`UNSCREENED_BLOCKS_HANDOFF`). Almost nothing was ever screened, so on the day this ships **every brand's existing artwork is unscreened**: anything added through any path but `POST /api/artwork` has to be added again before that brand can hand anything to a factory. Warning instead is one line, and the test holds both answers. | E113 | 0116 q1 |

---

## A. Money: a price or an amount only you can set

Nothing in the platform may answer one of these. Every figure below is a labelled placeholder today,
`CREDITS_ENFORCED` is off, and no brand has been charged anything.

| # | Question | Record |
|---|---|---|
| A1 | Credit prices, and then whether to set `CREDITS_ENFORCED=true` in production. Every credit figure below hangs off this one. | questionnaire 2026-10-25 q1 |
| A2 | Is the club ladder £29 / £25 / £22 (10–19 / 20–49 / 50+) the price to sell at? Seeded as "Placeholder club price from the build pack, not a factory quote"; no cost price is seeded at all. | 0071 q4; questionnaire 23 |
| A3 | ⛔ The AUD ladder: a conversion rule off the GBP ladder, or a second ladder quoted in AUD? | 0104 q1; 0074 q2; questionnaire 24 |
| A4 | Is there a price for 1 to 9 pieces, or is the real minimum ten? Class A is sold "from 1 piece" and the ladder starts at 10. | 0074 q1; questionnaire 22 |
| A5 | Are the stored sell prices before or after VAT? Until this is answered a quote cannot show a tax-inclusive total, and says so. | 0105 q4 |
| A6 | Does personalisation cost extra, and who decides — Knitwright or the Store? | 0106 q3 |
| A7 | Is a sample production package for a factory Knitwright does not own charged, and at what price? | 0070 q2 and revision 2 q2; questionnaire 21 |
| A8 | Who places the order, Knitwright or the brand? That is what decides whether the package is free. | 0070 revision 3 q2 |
| A9 | What is an AI mood image worth, and should it cost a credit? $0.04 against the usage meter today, no credit spent. | 0082 q3; questionnaire 90 |
| A10 | What does one AI picture cost, in credits? | 0093 q2 |
| A11 | What does a second of AI video cost, in credits, per model? | 0095 q1 |
| A12 | What does a generated picture or a clip cost in the launch shell and in a flow? A clip has no per-second figure at all. | 0091 q1; 0096 q1 |
| A13 | What does a run of "Write for me" cost? No credit price for AI copy exists. | 0094 q1 |
| A14 | What should a crest-to-kit run cost, if a model is ever wired to rank the kits? | 0105 q9 |
| A15 | Which picture providers should be used for shoots, and at what spend cap? Four exist behind keys; none has been called. | 0093 q4 |
| A16 | Should the automatic second attempt at a failed AI picture stay at the platform's expense? | 0093 q7 |
| A17 | Which model should the vision moderation check use, and should it run on every upload or only on artwork meant to print? It is a paid call per upload. | 0073 q3 |
| A18 | What terms of delivery (Incoterms) do we sell on? Empty today: the invoice says none is stated. | 0100 O1-7 |
| A19 | What is a "free plan" here, and should a watermark be lifted by spending credits as the media sets do? | 0094 q5 |
| A20 | Should Ask get a paid vector backend as well as full text? It would cost a paid embedding of every rule and every question. | 0083 q1 |
| A21 | The benchmark reader's accuracy against a real key: when should that measurement run happen, and against which model? | 0084 q6 |

---

## B. A factory's or a supplier's figure

One session with the Sialkot partner's pattern master and production manager answers most of this
group. The rest is the mill, the print house, the colour house and a customs broker. Everything here
is a labelled Knitwright draft today, and the screens say so.

### Dates, capacity and terms

| # | Question | Record |
|---|---|---|
| B1 | Lead time: 8 working days from the cut-off to ready for QC is the top of the spec's range. What has the factory agreed in writing, and does it differ by article? | 0071 q1 |
| B2 | ⛔ QC and packing: how many working days from ready-for-QC to handed to the carrier? Unset, so no delivery date is promised at all. | 0071 q2 |
| B3 | ⛔ Freight days to the UK and to Australia, per carrier and service. Also unset. | 0071 q3 |
| B4 | Weekly Class A slot capacity, in pieces. Not set, so nothing limits a batch. | 0071 q6 |
| B5 | Is Monday 12:00 Asia/Karachi the right cut-off, and should `/ops/settings`' UTC cut-off be retired so there is one cut-off, not two? | 0071 q9 |
| B6 | Minimum order per article: is 1 right for shorts as well as jerseys? | 0071 q8 |
| B7 | Factory cost and personalisation cost: the partner's quote, in which currency? The spec's $8.20–9.40 FOB and $0.80–1.80 are supplier self-claims, so nothing is seeded. | 0071 q5 |
| B8 | What is the largest order one factory will take without a conversation? No row says what one order may hold. | 0086 q4 |
| B9 | Which certificates does the partner hold (OEKO-TEX, GRS, BSCI), with what expiry, and should an expired certificate stop an order? | 0071 q11 |
| B10 | The factory's WhatsApp Business number, and whether an approved template message is needed before a first message. | 0071 q12; 0072 q4 |

### Colour, print and quality

| # | Question | Record |
|---|---|---|
| B11 | Which white point and observer does the colour house work to, and was the build pack's `#0B1F4B` → Lab example measured or computed? | 0070 q1, revision 2 q1, revision 3 q4; questionnaire 26 |
| B12 | Can the factory hold ΔE CMC(2:1) ≤ 1.5? R-SUB-005 itself asks the factory to confirm what they can hold. | 0071 q7; questionnaire 27 |
| B13 | Will the print house give us an ICC profile for the sublimation gamut? Brand Studio shows Knitwright's own chroma estimate. | 0079 q2; questionnaire 28 |
| B14 | What will the print house hold as the smallest and largest tile, and is there a preferred tile for a sublimation run? 1 cm to 200 cm is Knitwright's own default. | 0081 q3 |
| B15 | Is the safe zone 10 mm or 15 mm? R-SUB-004 says critical elements keep 15 mm from seams; the setting is a 10 mm Knitwright default. | 0076 q1; questionnaire 2026-10-25 q13 |
| B16 | Which decoration methods does each factory run? Heat transfer, screen print and embroidery stay locked until the factory model records them. | 0076 q3 |
| B17 | Which decoration the Class B stock-colour programme uses, and its print rules. | 0090 q7 |
| B18 | Which notch style does the factory need the DXF geometry itself to carry? The chosen style is stated in the README and on the 1:1 PDF; the writer marks one way only. | 0070 q4; questionnaire 32 |
| B19 | The default tolerances of `docs/spec/04` (±10 mm body, ±5 mm sleeve and waistband, ±3 mm compression) are placeholders to confirm. The gate refuses a POM with no tolerance rather than filling one in. | 0070 q5 |
| B20 | The AQL plan for a Class A sample at a partner factory. | 0070 q6 |
| B21 | What AQL plan has each factory agreed, and at what inspection level? Specifically: has `sialkot-partner` agreed a level, and should rulebook `R-QC-001` move out of `draft`? | 0089 q3 |
| B22 | ISO 2859-1 level II: can we have a copy, or the factory's own agreed plan? Every seeded sample size and accept/reject number was typed from a republished table and nobody has read it against the standard. | 0100 O1-1 |
| B23 | Is "AQL 0 critical" right as "accept 0, reject 1 at every sample size"? It is not a column of the standard. | 0100 O1-2 |
| B24 | What does a third-party inspection cost, who with, and how long does it take? | 0100 O1-4 |
| B25 | What defect rate fails a QC check? One defective piece in the sample still fails the order. | 0100 q25; questionnaire 2026-10-25 q25 |

### Fabric and compliance declarations

| # | Question | Record |
|---|---|---|
| B26 | ⛔ Has any mill declared any programme fabric PFAS-free? `pfas_free` is null on all six, so R-LAB-003 refuses every fabric. One declaration per fabric clears it. | 0089 q5 |
| B27 | Does any programme fabric hold an OEKO-TEX Standard 100 certificate? `oeko_tex_cert` is null on all six, so no label claims one. | 0089 q6 |
| B28 | Fabric blends, weights and finishes: which are confirmed, and are the Class B stock colours (black, white, navy placeholders) the real palette? | 0071 q13 |
| B29 | Should `F-POLY-RIB` join the fabric programme as a rib row? JSY-SS-01's rib is in `article.json` but not among the six programme fabrics. | 0074 q3 |

### The pattern and the article data

| # | Question | Record |
|---|---|---|
| B30 | ⛔ Size range, sample size, fit and gender for all seven other articles. The build pack publishes none. Nothing can grade, offer a size or price an article until they exist. | 0090 q1; 0066 q1, q3 |
| B31 | ⛔ Per article, from the factory: the pattern and size chart, the POM table with grades **and** tolerances, the construction table, seam allowances and thread, and the fabric's real code, weight and blend. Also: is JSY-LS-01's goalkeeper shirt the same base; does CRK-SS-01 need its own placket and collar group; is HOD-ST-01 pullover or zip; is CMP-LS-01's rash guard the same article as the compression top; and what sews FSH-MM-01, the only woven garment in the catalogue? | 0090 q6 |
| B32 | Where will the factory-checked master pattern come from? No article may go `live` without one (owner decision 10), and none exists. | 0068 revision 1 point 11 |
| B33 | Collar C02, collar C03 and the K02 sleeve geometry: the factory's own block shape, which owner decision 8 defers to the sample round. All three are refused as "not drafted yet" rather than guessed. | 0068 |
| B34 | Does the factory's shirt-tail block use a flatter or a fuller hem curve than a symmetric one? Both drop-tail control fractions are seeded at 0.5. | 0068 revision 1 q1 |
| B35 | What negative ease does the factory's 1x1 rib cuff take, and is it millimetres or a ratio of the opening? Seeded at 20 mm with no source. | 0068 revision 1 q2 |
| B36 | Is the K02 cuff cut to POM F (the finished opening), or to the sleeve edge it is sewn to, less the ease? POM F stretches the rib ~11 mm more at size M. | 0068 revision 1 q3 |
| B37 | Does the factory want a notch at the cuff's underarm seam? R-PAT-006 quarters the neck rib and says nothing about a cuff. | 0068 revision 1 q4 |
| B38 | `SHO-TR-01`'s inseam range: is R-SHO-002's 3 to 9 in the factory's range, and what step does it take? | 0090 q2 |
| B39 | The shorts' waistband, side split and pocket option codes. The build pack names the groups but no codes, so none can be offered. | 0090 q3 |
| B40 | Is `R-CON-010` spoken for? The build pack uses `R-CON-011` for the compression side seam while JSY-SS-01's rulebook ends at `R-CON-009`. | 0090 q4 |
| B41 | Band collar on JSY-SS-01: an option of this article (wanting a `C04`), or a different article? A design can ask for one today and the catalogue cannot name it. | 0099 q1 |
| B42 | A placket (buttons, zip): a code on this article, or a different article? | 0099 q2 |
| B43 | A contrast side panel: only a colour in the artwork, or a cut piece needing a code and a pattern? | 0099 q3 |
| B44 | A side-vented hem: a code or a parameter? `back_drop_tail` covers the curved hem; nothing covers a vent. | 0099 q4 |
| B45 | Name length per zone on the other articles, and does a longer name shrink to fit or get refused? The back name's 12 characters is R-PER-001 for one article. | 0087 q4 |
| B46 | A unisex size chart: the registry has no unisex wearer, so a unisex kit is shown the men's chart and the guide says so. | 0087 q6 |
| B47 | Does a base article get a placement table, so a crest and a sponsor slot can be placed rather than only recorded? | 0086 q7 |
| B48 | Will the factory give a standard chest-sponsor and crest width per article, so the DPI check can run without the brand typing a number? | 0079 q4; questionnaire 31 |
| B49 | How wide is a crest printed on a shirt? The dpi check measures against 80 mm, which is Knitwright's own figure and neither a factory's nor a league's. | 0105 q6 |
| B50 | Where does the body size chart live, and who supplies it? Spec F-S6's Body tab wants chest, waist, hip and height per size, and no catalogue table holds them. The numbers are the factory's. | 0077 q2 |

### Consumption and the bill of materials

| # | Question | Record |
|---|---|---|
| B51 | ⛔ Ask the Sialkot partner to lay a marker for JSY-SS-01 at 180 cm width and give back, per size: body fabric metres, rib metres, needle and looper thread metres, and the transfer-paper area. All five seeded figures are Knitwright drafts. | 0101 q1 |
| B52 | Is 0.80 m the size-M figure, or the average across the size run? A cost model wants the average; a cutting instruction wants the figure per size. | 0101 q2 |
| B53 | Should the package carry the four lines the article publishes and the bill of materials does not — back neck tape, heat-transfer neck label, polybag, transfer paper — each with a specification and a supplier reference? | 0101 q3 |

### The rulebook's own gaps

| # | Question | Record |
|---|---|---|
| B54 | What should the rulebook entry for pattern fills `P00` to `P02` say? They have no rule in `article.json` and are stored with `R-GAP-000`. | 0066 q5 |
| B55 | Care wording per destination market: `R-LAB-002` (fibre, care and origin) has no text, so the care row carries `R-GAP-000`. | 0074 q6 |
| B56 | The `R-GAP-000` checks X4 listed: each needs a rulebook entry, or a decision that the check should not exist. | 0069 q6 |
| B57 | The stitch density is quoted without its unit where the construction row leaves it out ("12-14"). Should the drafter add "per inch" from R-CON-001, or would that state what the row does not? | 0083 q5 |
| B58 | Does a factory want "Page 4 of 16" in the header as well as "Page x of y" in the footer? | 0078 q1 |
| B59 | Who numbers the construction callouts on the flat? Page 7 is the spec's "numbered callouts", and the platform has only the lettered points of measure. A factory's numbering convention would settle it. | 0078 q3 |

---

## C. A licence, a purchase or an account

Each of these costs money and nothing else unblocks it. Three of them are the reason whole features
are labelled rather than working.

| # | Question | Record |
|---|---|---|
| C1 | ⛔ **ISO 3758 is a paid standard and is not in this repository.** Will you buy a licensed copy and transcribe the care symbols — or take the wording from the factory's own licensed copy — and who confirms them? The `care_symbols` table is ready and needs five to about twenty rows and a name against them. Three separate workstreams hit this and none invented a symbol. | 0089 q1; 0104 q3 |
| C2 | ⛔ **Pantone.** Licence the TCX library, or keep asking brands to read their printed swatch book? Without a licence the Colours section cannot search codes and no screen can name a nearest Pantone. | 0076 q2; 0079 q3; 0105 q1 |
| C3 | **ISO 2859-1.** Can we have a copy, so the seeded AQL sample sizes can be read against the standard rather than against a republished table? | 0100 O1-1 |
| C4 | **Kit fonts.** Which faces should be licensed, and for which use — screen, sublimation print, and the factory's own RIP? Only the two bundled Geist faces have a licence this repository can show; four placeholders say no licence is on file. | 0079 q1; 0081 q1; questionnaire 30 |
| C5 | **A CMYK profile.** Which profile should we separate against? None may be committed, so every CMYK export is refused with a reason. | 0094 q2 |
| C6 | **A sublimation ICC profile** from the print house, which would turn Knitwright's own chroma estimate into a real soft proof. | 0079 q2 |
| C7 | **A licensed sport-graphics library.** Is there one to buy? The Elements panel offers only shapes this code draws, because no artwork may be committed. A real library needs a licence that covers merchandise. | 0094 q3 |
| C8 | **AI model presets with people in them.** Which may be offered at all, and what licence reference do we hold for each? Nothing can be generated with a person in it from a preset until this is answered. The six seeded rows describe the range the spec asks for and hold no licence. *(The questionnaire does not yet ask this; a question of its own is owed.)* | 0093 q1 |
| C9 | **AI video models.** Which may be offered at all? The four the spec names are seeded as placeholders and none is called. Someone has to read their terms. | 0095 q2 |
| C10 | **Music.** Should sound ever be anything but the model's own? No music ships and no music licence is held. | 0095 q5 |
| C11 | **Stock photo providers.** Which keys do we actually hold — Unsplash, Pexels, or both? Unsplash's free tier is 50 requests an hour and its production tier needs their approval of the application. | 0082 q1 |
| C12 | **Pinterest.** Do we apply for Standard access now? Without it the boards source is a demo for the owner's own account only. | 0082 q2 |
| C13 | **League rule books.** Which leagues' number and name rules should we hold, and where do we get them? Only football and rugby are seeded, as Knitwright defaults with no rule book on file. | 0087 q3 |
| C14 | **Couriers.** Which couriers, and do we want label booking and tracking links through their API? Only the manual option is seeded. | 0100 q24; questionnaire 2026-10-25 q24 |
| C15 | **The email provider.** Which provider and which sending address should Knitwright use, and what should an invite's subject line say? Resend is the adapter that is written. | 0081 q7; questionnaire 2026-10-25 q47 |
| C16 | **A WhatsApp Business number.** Who owns it, and should we apply for an approved template message? Plain text is allowed only inside a 24-hour window the factory opened, so a first message may be refused until a template is approved. | 0072 q4; 0071 q12 |
| C17 | **A CPSIA test certificate.** Is one being sought? Until one exists the United States stays closed and no youth garment may be made for any market. | 0089 q4 |
| C18 | **The Vercel account on Pro**, with Node 22 or 24. Owner action A2. | sign-up switch |
| C19 | **The hosted Supabase project and its keys**, with the "Before user created" hook switched on — without it anyone can register, whatever the sign-up switch says. | `../runbooks/supabase-hosted.md` |
| C20 | **Turnstile with real keys, Google sign-in, and an EU Sentry project** for `MONITORING_DSN`, with one test error seen to arrive. A deploy refuses Turnstile's test keys. | sign-up switch |

---

## D. A lawyer or an adviser

A legal position, a customs position or a copyright opinion. None of these is guessed anywhere in the
platform; each leaves a labelled note instead.

| # | Question | Record |
|---|---|---|
| D1 | Does the United Kingdom, Australia or the European Union require an importer or responsible-person address on the label, and does any market require its own size-designation wording? Both are legal positions. This is the legal consult rulebook entry `R-LAB-002` already asks for. | 0089 q2; 0104 q4 |
| D2 | Has Knitwright registered for GST in Australia, and is the AUD 75,000 threshold the right one for us? | 0104 q2 |
| D3 | VAT and thresholds: GB 20% with a £135 low-value threshold and DCTS preference, AU 10% with a A$1,000 threshold are public figures to confirm with a customs adviser. Also: which HS codes, and what duty under each? | 0071 q10 |
| D4 | Which HS code does each base article take, from a customs broker? Where `base_articles.hs_code` is null the invoice prints the gap instead of a heading. | 0100 O1-6 |
| D5 | The report form and the takedown flow need a lawyer's eye, and an address to send notices to. | 0073 q6 |
| D6 | What happens at three upheld notices — a warning, a stop on new orders, or an account closed? And who decides? | 0073 q4 |
| D7 | Should the offensive-word list be reviewed by somebody, and should a club be able to ask for a word on it to be allowed for their own name? | 0073 q2 |
| D8 | Eight consecutive words is our paraphrase line for a complaint theme. That is a drafting convention, not a legal opinion, and should be checked by whoever advises on copyright. | 0084 q2 |
| D9 | What wording should a brand tick when it uploads its own model, and what proof must it hold? `CONSENT_STATEMENT` is a draft and should be read by a lawyer before anybody relies on it. | 0093 q3 |
| D10 | Is "I own this logo or have permission to use it on garments" the right sentence for a **product photo**? It is the wording already on file and already versioned, and a photograph is not a logo. | 0102 q8 |
| D11 | Is "You said you own this or may use it on garments" the right way to show a rights record on screen? It is a plain reading of what the row holds; a lawyer has not seen it. | 0108 q6 |
| D12 | Does a brand need to prove the site it imports from is its own? Today the only check is that every picture is on the pasted page's own domain. A DNS record, a file at a known path or an email on the domain is the honest answer. | 0102 q7 |
| D13 | Is the Instagram content-network allowance acceptable? `cdninstagram.com` and `fbcdn.net` are treated as serving the brand's own pictures when the pasted address is on `instagram.com`. Without it an Instagram import finds nothing; with it we fetch from a host the brand does not own. | 0102 q4 |
| D14 | Should a committee member's email be asked for rather than offered, with the consent record decision 0025 keeps? Today a name is required, an email is optional and nobody is emailed. | 0087 q2 |
| D15 | What may a committee member see of another's comments? Nothing today. Showing them is a decision about personal data on a link anyone holding it can open. | 0087 q5 |
| D16 | Should a factory's photo be kept forever? There is no retention rule yet: photos stay until the batch's orders are deleted, and nothing deletes them. | 0072 q6 |
| D17 | The legal review of the terms, privacy notice and data-processing terms in `docs/legal/`, with every `[square bracket]` filled and each document's `status` set to `"approved"`. Owner action A9, and the sign-up switch will not open without it. | sign-up switch |

---

## E. A product decision, yours alone

What Knitwright wants the platform to do. None of these blocks anything: each is live behind a
labelled default today. They are grouped by the surface they are about so they can be read in one
sitting with that screen open.

### The editor and the design object

| # | Question | Record |
|---|---|---|
| E1 | A form change cannot be saved: decision 0069 added `article.parameters` to the spec and no action that writes it. Who owns the one-member addition to `specActionSchema`, and in which wave? Until then the Form toolbar's choices live only in the address. | 0075 q1 |
| E2 | How is a founder's own point of measure, or a callout, stored? There is no `SpecAction` for either, so a mark shows on the tech pack and is lost on a reload. Who owns that change? | 0077 q1 |
| E3 | Is "Not yet sampled" a warning or a lock? A lock would disable every option of every article until golden samples exist. | 0075 q2 |
| E4 | The auto-name's wording: is "Crew neck · Coverstitch hem · Plain · Body length +20 mm" what you want, and should it replace the typed design name rather than sitting under it? | 0075 q3 |
| E5 | Does the editor need its own credits counter? The studio header already shows one. | 0075 q4 |
| E6 | Should a pattern fill be able to hold a tile width and height, padding and rotation? Today a kit pattern stores one size and, for dots, its spacing. | 0076 q4 |
| E7 | Should a graphic's placement be gradable per design, or does the base article always decide? | 0076 q5 |
| E8 | Should the outline colour become a field of its own on the saved design, carried through the tech pack, Excel, the PDF and the flats? Today it is written into the one colour instruction. | 0081 q2 |
| E9 | Should a published repeat keep its recipe — tile, style, layers, background — so it can be re-opened and changed, and shared between a brand's designs? | 0081 q4 |
| E10 | Should `lib/parametric`'s sleeve carry `underarm-a` and `underarm-b` landmarks, so a sleeve band lines up with the body's chest line? | 0070 revision 3 q1 |
| E11 | Should a `pattern_fill` code be recorded beside the artwork, or should the `P00`–`P02` codes go? Every package names the default `P00` today, which is the article's data but is not a statement about the artwork. | 0099 q5 |
| E12 | `C03` cannot be reached from any designer-facing word. Should the registry gain a neck-finish question (rib against self-fabric binding), or should `C03` wait for the editor's own tiles? | 0099 q6 |
| E13 | A raglan sleeve, a long sleeve and a slim or relaxed fit are offered by the registry and are not this article. Should a design that asks for one be refused? It is not today. | 0099 q7 |
| E14 | Two rule families do not exist in the rulebook: no `SHO` family, which `R-SHO-002` needs, and no `FAB` family. Should they be added? | 0090 q5 |

### Validation and ordering

| # | Question | Record |
|---|---|---|
| E15 | Must every order be accepted for ordering first, or may a validated version be ordered straight away? Today it may. | 0069 q1 |
| E16 | Who in a brand may accept a version for ordering: any member, or only an owner or admin? Today any member may. | 0069 q2 |
| E17 | Should a version that was validated or accepted go back to draft when the factory profile it was judged against changes? Today it does not. | 0069 q3 |
| E18 | The spec's export format holds 8 colours and 60 characters of printed text; the editor allows 48 and 80. Bring the editor down, or raise the export format? | 0069 q4 |
| E19 | Is a picture still waiting for the content review a warning (today) or a blocker before an order? | 0069 q5 |
| E20 | Does a Class B run need a person's look at the design version only, or at every picture in it as well? | 0073 q5 |
| E21 | A set of real uploads, good and bad, with the marks they should and should not match, so the two picture distances and the 12-bit detail floor can be measured instead of guessed. | 0073 q1 |
| E22 | Should a flagged AI picture be usable in a listing before a person has looked at it? It is shown to the brand and marked as waiting for review today. | 0093 q8 |

### The tech pack and the production package

| # | Question | Record |
|---|---|---|
| E23 | Which PDF page carries the body size chart? The spec's page list has sixteen pages and none is the body chart, while its export picker offers one. It is on page 1 today. | 0077 q3 |
| E24 | Is `fixed` a fourth grade type for good? `article.json` uses it and the spec's tab shows three. | 0077 q4 |
| E25 | Should the Review tab's four unread items (gamut, resolution, bleed, moderation) be shown at all, or left to the Export panel alone? | 0077 q5 |
| E26 | Should pages 2 and 3 of the PDF be the same two drawings twice — the technical flat, then the same views in the colourway? | 0078 q2 |
| E27 | Is the Body size chart sheet wanted empty, or left out until the base article carries one? | 0078 q4 |
| E28 | Which image sizes does a factory or a marketplace actually want? 600, 1200 and 2048 pixels are labelled defaults and no factory has asked for any of them. | 0078 q5 |
| E29 | Does `04_print/<size>/` keep the `SAMPLE_` prefix? The spec's folder tree and its naming paragraph disagree; the naming paragraph was followed. | 0070 q3 |
| E30 | Should the export route offer a batch package too, or does a batch stay ops's own path? | 0070 revision 3 q3 |
| E31 | Who records a factory's consumption figure, and does it replace Knitwright's or stand beside it? The table versions the line, so both are kept and the package is built on the newest. | 0101 q4 |

### The job packet and the factory's own screen

| # | Question | Record |
|---|---|---|
| E32 | How long should a factory's link last by default? 28 days is a labelled default chosen to cover cut-off to QC. | 0072 q1 |
| E33 | Should the link be per batch or per factory? Per batch today, which keeps a leak to one batch but gives a factory with ten batches ten links. | 0072 q2 |
| E34 | Should a factory's reply name a person? `factory_events` records no name, so the scorecard cannot tell two people at one factory apart. | 0072 q3 |
| E35 | Should the factory see prices? It does not today. | 0072 q5 |

### Ops

| # | Question | Record |
|---|---|---|
| E36 | An ops order names its fabric by the Store's key. Which programme fabric code does each map to, so a ΔE reading can be judged by the right `colour_delta_max`? | 0100 O1-3 |
| E37 | Is 300 pieces the right threshold for offering a third-party inspection? | 0100 O1-5 |
| E38 | Who cuts batches and when? A button today. | 0043 / checklist |

### The rulebook, "Why?" and Ask

| # | Question | Record |
|---|---|---|
| E39 | Should a "Why?" show the newest confirmed version when the newest version is still a draft? | 0067 q1 |
| E40 | Is "every article" right for the shared `R-SUB`, `R-LAB`, `R-QC` and `R-COST` rules, or should they list only sublimated articles? | 0067 q2 |
| E41 | Is the source sorting right — "Supplier price lists, May 2026" as `factory`, "Grading practice" as `standard` rather than `pattern_master`? | 0067 q3 |
| E42 | Should a member be able to ask at all before the factory has signed the rulebook off? Today every answer to a member is "not covered", which is correct and makes the box look broken. | 0083 q2 |
| E43 | Is `ask:<question>` the right key for the gap list? It counts repeats of the same wording, not of the same question. | 0083 q3 |

### Inspiration and benchmarks

| # | Question | Record |
|---|---|---|
| E44 | Should a product page be fetched by the inspiration board at all, or only by benchmarks? Two fetchers exist; the orchestrator may want one of them to go. | 0082 q4 |
| E45 | Sixty items a moodboard, two seconds a source, twelve tags a query are all Knitwright defaults. None was measured. | 0082 q5 |
| E46 | Are the benchmark fetch allowances right? Twenty competitor pages an hour per brand, five from any one site, chosen to be polite. | 0084 q1 |
| E47 | Should a benchmark photo have an upload of its own — a private photo of somebody else's product, kept for comparison, never placed on a panel? The artwork upload's rights statement would be a false statement on that row. | 0084 q3 |
| E48 | Should a benchmark expire? A card is a fact about a page on a day; a year later it may be wrong in every line. | 0084 q4 |
| E49 | Who may read a brand's benchmarks? Every member today, as with designs. | 0084 q5 |

### Teamwear, crest-to-kit and the club

| # | Question | Record |
|---|---|---|
| E50 | Should a kit be a row of its own, so one press saves the shirt, the shorts and the socks together and one link opens the set? Three parts are three designs today. | 0086 q1 |
| E51 | ⛔-adjacent: **is a sock article coming?** Until one exists the socks of every kit are a colour with no price, and every quote says the total leaves the socks out. | 0086 q6; 0098 q3; 0105 q3 |
| E52 | Should `lib/kit-styles/presets.ts` offer its styles for the teamwear registry types, and should the launch articles carry print fill codes for bands, a sash and side panels? These are the same question from two sides, and the reason three of six crest-to-kit families are not offered. | 0086 q2; 0105 q2 |
| E53 | What address should "Order through the Knitwright Store" open once the Store exists? It shows a reference now. | 0086 q3 |
| E54 | Should `ProposalSource` gain a `teamwear` member? A kit saved in the configurator is filed as `kit-style`. | 0086 q5 |
| E55 | Should a quote be stored and numbered in a sequence, so Knitwright can look one up when a club quotes it back? The number is derived from the day and the basket, and nothing keeps a record of it. | 0105 q5 |
| E56 | Should a quote take a delivery postcode? Nothing in the factory data is finer than a country, so it would be a field with nothing behind it until a carrier gives rates by area. | 0105 q10 |
| E57 | Should the create-new modal's "From your crest or logo" card open `/crest-to-kit`? It opens `/club` today. | 0074 q5; 0105 q7 |
| E58 | Should the configurator's "ideas" rail button and its "Quote" button be wired to crest-to-kit now? Both seams exist on each side. | 0105 q8 |
| E59 | How long should a committee link last? 30 days, from the spec. A club that meets monthly may miss it by a week. | 0087 q1 |
| E60 | What should the chase wording say, and should a second, firmer message exist? Both are Knitwright defaults. | 0087 q7 |
| E61 | How many answers may one link take? 300 answers, comments and votes per link, and 200 people per season's list. A county-wide club could pass the last. | 0087 q8 |
| E62 | Who may lock a version — anyone who may manage the kit, or an admin only, given it moves a design to `approved` and cannot be undone? | 0087 q9 |
| E63 | Should there be a way to record a withdrawal against an approval? Today a committee member who changes their mind can only have another approval recorded. | 0087 q10 |

### The studio home, the catalogue and the top bar

| # | Question | Record |
|---|---|---|
| E64 | Nothing is created-dated or use-counted, so Newest and Most used cannot be offered and the "NEW" tag cannot be shown. Worth adding? | 0074 q4 |
| E65 | Sports for `JSY-LS-01`, `HOD-ST-01` and `CMP-LS-01`: the build pack names none, so they have no sport tag and appear under no sport filter, although the template library lists two of them under Football and Training. | 0066 q2; 0090 q8 |
| E66 | Is a `crew-tee` design really a `TEE-TR-01`, and should fight shorts get a registry type? | 0066 q4 |
| E67 | Should `sport_tags` gain `afl` and `netball`, and should the registry gain a sleeveless guernsey? | 0104 q5 |
| E68 | **The studio top bar's growth.** An overflow menu beyond the first four sections, collapsing the account cluster into one menu, or letting the bar be wider than the page column? Decision 0103 implemented four pills plus an overflow menu; the remaining choices are below. | 0079 q5; 0086 q8; 0091 q5; 0092 q6; 0096 q6 |
| E69 | Between 1024 px and about 1110 px, which gives way: the brand's name or the four section pills? | 0103 q1 |
| E70 | Should Benchmarks keep both entries — the studio sidebar and the bar's overflow menu? | 0103 q2 |
| E71 | `.soft-link`'s `opacity: 0.9` takes `--cobalt-soft` to 3.92:1 over the brightest part of the aurora, on ten links across the product. The one fix is one line of `globals.css`, and it changes the hover of about forty links. | 0103 q3 |
| E72 | Should the account menu show who is signed in without being opened? | 0103 q4 |

### Launch: the shell, mockups, scenes, marketing, video and flows

| # | Question | Record |
|---|---|---|
| E73 | What artboard sizes should a launch start from, and at what resolution? The six seeded sizes are the spec's own, each labelled "not reviewed by anyone", and A4's 300 dots per inch is a guess. | 0091 q2 |
| E74 | Does the owner want the Apps icon at all? It is left out, because the Store is separate. | 0091 q3 |
| E75 | Should undo reach adding and removing a board? A restored board would get a new id. | 0091 q4 |
| E76 | `07` asks for 40 mockup scenes and names 35. Which five are missing, or is 40 the wrong number? | 0092 q1 |
| E77 | Should the three-quarter, side and turntable views come from a real 3D render on the server? Today the server draws the flat and turns it, and says so on every picture. This is the single biggest improvement available to that surface. | 0092 q2 |
| E78 | Are "Home", "Away" and "GK" the colourway names a brand is expected to use, or should the roles be a field on a colourway? | 0092 q3 |
| E79 | What colour is the studio backdrop, and what is on the shop wall? Every backdrop is a seeded colour labelled "not reviewed by anyone", and they are what a brand notices first. | 0092 q4 |
| E80 | Should the free mockups carry the free-plan watermark? Nothing here watermarks anything. | 0092 q5 |
| E81 | Which style belongs to which shoot? The spec names five styles and says nothing about which shoot uses which. | 0093 q5 |
| E82 | How many poses should a garment-only shoot offer? The spec asks each shoot for three to six and the changing-room scenes name one between them. | 0093 q6 |
| E83 | What should the marketing character limits be? Headline 40, subheadline 70, body 160, callout 48 and highlight 140 are Knitwright's own and nobody has reviewed them against a real post. | 0094 q4 |
| E84 | Is "Team store" the right name for that group of layouts? They are posters with no link, no cart and no payment anywhere near them. | 0094 q6 |
| E85 | Should a video model whose commercial licence nobody has read be offered and labelled, or hidden? It is labelled today; the spec's words are "commercial-licence models only". | 0095 q3 |
| E86 | Is the studio turntable 8 seconds or 6? Decision 0058 records 8 for the media-set turntable; the spec says 6 for the launch video. Both are in the code. | 0095 q4 |
| E87 | Should a deterministic video be kept in the design's media set, and under what kind? A flip, a kit reveal and a carousel are none of the four existing kinds. | 0095 q6 |
| E88 | How many frames should the media checker sample, and at what thresholds? Five is a Knitwright default and the thresholds are still untuned. | 0095 q7 |
| E89 | How do the asset counts of `07` split across a flow's steps? The counts are the spec's and are held to by a test; the split is Knitwright's reading, and three packs needed one. | 0096 q2 |
| E90 | Is a flow template a thing a platform admin edits? It is rows, so it can be; there is no screen for it. | 0096 q3 |
| E91 | Should a failed board stop the whole run, or only what it feeds? Today a failure skips the boards it feeds and lets the rest finish. | 0096 q4 |
| E92 | Is a tutorial film going to be made? Every pack has the spec's "Watch tutorial" card, and every card says no film exists. | 0096 q5 |
| E93 | Should a like exist at all? A real Likes panel needs a record of who liked what — a table, its row level security and a write path. | 0108 q1 |
| E94 | Should starting a design from a template in the launch rail open the editor, or should a Design board offer a template when the project has no design yet? | 0108 q4 |
| E95 | Should the launch rail's Templates panel offer the kit bundles? `template_kit_bundles` holds the spec's fifteen and has no browser surface at all. | 0108 q5 |

### Brand Studio and brand import

| # | Question | Record |
|---|---|---|
| E96 | Who wires the brand-import screen? The engine and its view model are done; the panel, the route and the stage-by-stage progress need a component path. (Blocking for the feature to be usable at all.) | 0102 q1 |
| E97 | Should a brand-import run survive a reload? A minute-long import loses its proposal if the person navigates away. A `brand_import_runs` table would fix that and let the stages be polled rather than streamed — and would also let the screen keep a picture. | 0102 q2; 0108 q2 |
| E98 | Is it right that the import screen saves the texts, the colours and the fonts but not the pictures? | 0108 q3 |
| E99 | Are the brand-import fetch allowances right? Six imports per brand per hour, forty requests to one site per hour, sixteen pictures per import, ten seconds per request, a minute in all. | 0102 q3 |
| E100 | May `lib/providers/text-model.ts` take several pictures per call? The spec asks for a style written from five or more images; the interface takes one, so the model sees one picture and the facts of the rest in words. | 0102 q5 |
| E101 | Should the `brand_import.*` settings appear in the platform console? They have keys, schemas and defaults and no admin can change them yet. | 0102 q6 |

### The template library and the Store contract

| # | Question | Record |
|---|---|---|
| E102 | Should the `sport` column become the spec's six groups? It holds five values today, and esports and combat live in `sport_tags` only, so the sport filter cannot offer them. | 0098 q1 |
| E103 | Four of the spec's football styles have no geometry in the editor — half-and-half, chevron, retro-90s geometric, camo fade — and the same holds for combat's tribal/geometric and cricket's shoulder flash. Should the kit-pattern vocabulary grow, or do they belong to artwork? | 0098 q2 |
| E104 | Is `general` the right home for an esports or combat starter until E102 is answered, or should such a starter not be listed under a sport at all? | 0098 q4 |
| E105 | Which era and mood words does the owner want? `classic`, `retro-90s`, `modern` and `bold`, `clean`, `sharp`, `playful`, `understated` are Knitwright's own, and they are a closed check in the database. | 0098 q5 |
| E106 | Phase 4 designer templates: the ledger is built and nothing opens the door. | 0098 q7 |
| E107 | Which design is a team store's? Nothing records which design a club's kit was settled on, so the newest listed product's design is used. | 0106 q1 |
| E108 | Should the Store be able to mark a hand-off collected? `flow_listings.collected_at` is still null everywhere; it is a write, so it needs a function and a migration. | 0106 q2 |
| E109 | Should a product with gaps be offered to the Store at all? The payload hands over everything and says what each gap stops. | 0106 q4 |
| E110 | How long should a Store token live, and should the Store get one secret or one per environment? Five minutes per call today, one secret per deploy. | 0106 q5 |
| E111 | Which markets may the Store sell in? `country_rules.selling_enabled` is the switch. | 0106 q6 |

### Australia and Translate

| # | Question | Record |
|---|---|---|
| E112 | Should Nastaliq be made to work — by pinning a `fontkit` that places its anchors, or another route — or does the Urdu tech pack stay in Naskh? | 0104 q6 |

---

### The wiring after the reviews (decisions 0116 to 0124)

The four reviews of plan v5 and the wiring that followed them raised these. Every one is already live
behind a labelled default or a stated refusal, as the rest of this file's are; none of them is a
missing feature pretending to be a question. Two of the twenty are answered and listed at the top of
this file instead.

| | Question | Record |
|---|---|---|
| E113 | **Should an unscreened picture block "Ready for the factory", or only warn?** It blocks today. Almost nothing was ever screened, so every brand's existing artwork is unscreened and has to be added again through a screened path before that brand can hand anything over. ⛔ above. | 0116 q1 |
| E114 | Is the moderation wiring complete enough for launch, or is the rest of it wave 6 with a date? Three upload paths are unscreened because there is nothing to screen — a size chart and a pattern DXF carry only a label, and the factory's job-packet photo arrives on a token-authenticated route with no session to meter a vision call against. | 0116 q2 |
| E115 | Should a human review be about the frozen release, or about the design version? Both order paths carry a release uuid and the Class B check is written against it; a review of the design version would outlive the release and cover work the release never contained. | 0116 q3 |
| E116 | **Two names-and-numbers editors exist and a person can meet either.** Decision 0027's controls are on the `Names` tool; Y8's F-S4 panel opens from the Design Summary. They write the same stored fields so they cannot disagree, but which one survives, and may the other be taken out with the journey that drives it? | 0117 q2 |
| E117 | Where does the repeat maker belong? It is under the Library toolbar's Pattern fills, which is where a pattern is chosen rather than where one is made. | 0117 q3 |
| E118 | Is the Specs toolbar the Ask box's place? It is scoped to the design it sits beside, which is right; whether Specs is the tab a person looks in for a question is not settled. | 0117 q4 |
| E119 | What happens to the right-hand panel between 1024 px and 1279 px? That band is the one width the editor's shell was never designed for. | 0117 q5 |
| E120 | **Should the production package's refusal reach a screen?** The F-G2 gate now names every gap in one answer, each sentence carrying its rule id — and the only way to reach it is the route the Store would call. The Export panel's own tab says the package is built "when the order is placed" and offers no download. No panel owns it (0108). | 0122 |
| E121 | Should the turntable carousel wait, or should every page that draws a flat pay for the other colourways? Drawing them all is work on every page that shows a garment; drawing one is a carousel that cannot turn. | 0123 q1 |
| E122 | Is "the upper chest" the right place to frame a crest? Nothing measured says so, and a mockup that frames it wrongly is a picture a brand may send to a club. | 0123 q2 |
| E123 | Should a mockup of a chart scene draw the design's own size or colour chart, rather than a stand-in? The scene exists; what it shows is a choice. | 0123 q3 |
| E124 | Should "Run all" be offered anywhere but the run summary? It is the one control that spends credits across several boards at once. | 0123 q4 |
| E125 | **Should `DESIGN_IMPORT` be on?** The design-from-a-picture panel has a screen now and is dark behind that flag. P12 and the privacy paragraph about pictures sent to vision providers are unchanged. | 0124 q1 |
| E126 | **Should a design be able to store a pattern layer, so the other nine drawable styles can be chosen?** 43 of the 51 looks in the gallery say they cannot be saved yet, because a design stores one kit pattern and not a layer. | 0124 q2 |
| E127 | Should the studio home offer the step-by-step start? `/studio/start` is reached from `/templates` alone, and decision 0074 replaced the home's two tiles with F-S4's action cards. | 0124 q3 |
| E128 | **Who is `/api/pattern-library/programmes` for, and when does the pattern library open?** The route is `auth: "member"` and refuses everyone with "The pattern library is not open yet" (`patternLibraryOpenTo`). Nothing in the repository says who the allow-list is for. | 0124 q4 |
| E129 | Is "Use the suggestion" the right way back from a chosen pattern size? Nothing records that a brand once chose one, so putting the suggestion back loses the fact that a person had decided otherwise. | 0124 q5 |
| E130 | **Who builds "apply this reading to this design"?** `acceptImport` keeps the read layers on the reading's row and the pictures as brand artwork; it does not write them onto the design the panel is open on. `designWithStack` is the function that would, and no import path calls it. The panel says so plainly rather than claiming otherwise (0038 item 6 deferred it). | 0124 q6 |

---

## F. A name against something

Six questions whose answer is a person. Each one is a place the platform refuses to say a thing is
settled until somebody with a name says so.

| # | Question | Record |
|---|---|---|
| F1 | **An Urdu speaker — the factory's own floor supervisor is the obvious person — to read the 29 translated strings**, so each one records who read it, their role and the day. Until then no string is shown as reviewed. | 0104 q7 |
| F2 | **Who confirms the ISO 3758 care symbols** once they are transcribed? The table refuses a `confirmed` row that is not a whole row, so a name is part of the data. | 0089 q1 |
| F3 | **Name the person who signs off the rulebook, and their role.** Decision 14 settled that a confirmation records a person; decision 0129 built the session that takes the name once and confirms every rule they reviewed in one press, with the 29 that rest on Knitwright's own words or a published standard offered ticked and the 16 that defer to a factory, a supplier or a lawyer offered unticked. Until a name is given, all 45 stay drafts and every "Why?" and best-practice card in the Studio says nothing is written yet. | 0067 q4, 0129 |
| F4 | **What makes a template `reviewed` — a factory, or Knitwright?** Every one of the 60 is `not_reviewed` and says so on its card. It is not written down anywhere. | 0098 q6 |
| F5 | **Who reads the Ask gap list, and how often?** The feature's value depends on gaps becoming rules. There is no alert, only the list on `/admin/rulebook`. | 0083 q4 |
| F6 | **Who signs**: names and roles for pattern, print, production and club sign-off. Sign-off records accept any member with a typed role today. | P10 |

---

## P. The 2026-10-15 items (P1 to P17), recovered

The launch checklist named `docs/owner/open-decisions-2026-10-15.md` for items P1 to P17 and said the
file was missing. **It was never in this repository** — no commit on any branch has ever held a file of
that name — but the items themselves are written down here, and have been all along:

- **P1 to P17** are the table in **`plans/production-outputs.md`, section 7, "Owner input, and how work
  proceeds without it"**, one row each, with what the platform does until the owner answers.
  `apps/web/lib/techpack/production/owner-inputs.ts` reads that section and is the code that shows them.
- **A5** is **`docs/owner/size-charts.md`**, "Owner action A5: size charts for every garment family".

So nothing is lost and nothing needs restoring. The questionnaire of 2026-10-25 says the ones that
matter most there are P1 (its question 36), P4 (37), P5 and P14 (print house rules, 13 to 17), P10 (38),
and P12 and P16 (35). Several have since been asked again by a v5 workstream in sharper form, and those
are cross-referenced below.

| # | Needed from the owner | Also asked as |
|---|---|---|
| P1 | A technician to review each pattern block. | questionnaire q36 |
| P2 | Patterns for the products the drafter cannot draft, and the sock factory's knitting programme. | B31, E51 |
| P3 | Australian size charts and junior labels, women's 3XL, and which pattern size each label is cut from. | B30, A5 |
| P4 | Fabric tests per base fabric: stretch at load, recovery, sublimation shrink at the press settings. | B28 |
| P5 | The print house profile: ICC file, dpi, maximum print width, the bleed they want, colours that sublimate badly. | B13, B15 |
| P6 | Pantone: whether Knitwright licenses a library. | **C2** ⛔ |
| P7 | League or competition rules: number heights, digits, contrast, sleeve badges. | C13 |
| P8 | Lettering fonts for names and numbers. | C4 |
| P9 | Marker efficiency and usable fabric widths from the factory. | B51 |
| P10 | Who signs: names and roles for pattern, print, production and club sign-off. | **F6** |
| P11 | Whether the Platform and Store Guide supersedes the 2026-09-27 decisions (AUD, Australia). | 0104 |
| P12 | Wording for the privacy page and terms about pictures sent to vision and image providers, and uploaded-artwork rights. | D17 |
| P13 | A golden set of real images for design-from-image: 10 to 20 mockups, flats and photos, plus what "close enough" means. | E21 |
| P14 | Print house minimum dpi for photographic and for line art, and its accepted file types. | B13 |
| P15 | Whether Pantone is shown: the licence, and whether TCX or TPG. | **C2** ⛔ |
| P16 | Price cap per picture read, and who pays beyond the free allowance. | A17 |
| P17 | Whether user-uploaded AI files with no PDF stream should be accepted by a paid converter later. | — |

---

## Two records whose questions are not in this repository

`0080` (make, samples, golden samples) and `0085` (the collection plan and the line plan) both have an
"Owner questions" heading whose whole content is "Recorded in the pull request comment." Those
questions are on GitHub and nowhere in the repository, so they are not in this list and cannot be
counted. They should be copied into their records.
