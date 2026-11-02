# Knitwright platform: the owner questions of plan v5, waves 1 to 3

Written 2026-10-30, as the companion sheet to `plans/platform-v5.md`, "Owner questions collected, as decisions 21
onward". The plan is authoritative: it says what the platform does today for each question, in which file or seed.
This sheet is the place to answer, in the same shape as `questionnaire-2026-10-25.md`.

**How to use this.** Answer in any order; the **Do first** list below is the shortest path to a platform that can
show a price and a date. Write your answer on the line. "Keep it" is a valid answer everywhere, and where you
write it the labelled default stops being a placeholder and becomes your decision.

**Nothing here is blocked while a question is open.** Every one of these is already live behind a labelled default,
and no page states a fact nobody has agreed; it names what is missing instead.

**No number below was agreed with a factory, a print house, a colour house or a lawyer** unless the plan's decision
says so. I am none of those things.

**Not asked twice.** `questionnaire-2026-10-25.md` (plan v4) already asks for the credit prices (its question 1),
the price ladder and MOQ per article (4), the lead time (5), the cut-off (6), the factory per article (7), the
swatch book and colour measurement (8), the print house ICC profile (17) and the acceptable defect rate (25). Where
a question below is one of those, it says so: answer it once, in either place.

---

## Do first (the seven that hold up a price, a date or money)

| Plan decision | Question | Why first |
|---|---|---|
| 21 | The price of a sample package for a partner factory, and whether to charge at all | Money. Nobody has been charged; `CREDITS_ENFORCED` is off |
| 22 | Is there a 1-to-9 price, or is the real minimum ten pieces? | A one-piece order has no price anywhere today |
| 23 | Is the club ladder £29 / £25 / £22 the price to sell at? | Every price on every screen is that placeholder |
| 46 | How many days for QC, and how many freight days? | **No delivery date is shown anywhere** until both are set |
| 26 | The colour house's white point and observer | Decides what a ΔE of 1.5 means |
| 47 | What is the real Class B quantity range, if any? | The platform now flags 50-to-300 rather than refusing it |
| 90 | What is an AI mood image worth? | Money. The usage meter carries $0.04 and no credit is spent |

---

## A. Money (plan decisions 21 to 25, and 90)

**21. A sample production package for a factory Knitwright does not own: is it charged, and at what price?**
Today: charged, at a labelled placeholder price, free when Knitwright makes it and free for a batch (decision 20).
Nothing presents the number as a price and the credits gate is off, so no brand has been charged.
Your answer: ______

**22. Is there a price for 1 to 9 pieces, or is the real minimum ten?**
Today: Class A says "from 1 piece", the factory row's minimum is 1, the ladder starts at 10, and a smaller
quantity reads "no tier covers it".
Your answer: ______

**23. Is the club ladder £29 / £25 / £22 (10-19 / 20-49 / 50+) the price to sell at?**
Today: seeded as "Placeholder club price from the build pack, not a factory quote". No cost price is seeded at all.
Same as question 4 of the 2026-10-25 sheet.
Your answer: ______

**24. Australian prices: a conversion rule off the GBP ladder, or a second ladder quoted in AUD?**
Today: every AUD price is empty and every Australian price reads "not set yet".
Your answer: ______

**25. The 40% deposit / 60% before shipping schedule is the Store's to collect, not the platform's to show?**
Today: recorded as the Store's and not built; the make pages stop at the price, the date and the hand-off.
Your answer: ______

**90. What is an AI mood image worth, and should it cost a credit?**
Today: $0.04 against the usage meter's `photoreal` allowance and no credit spent, while the spec says mood images
are charged as credits.
Your answer: ______

---

## B. Colour, print and licences (26 to 32)

**26. Which white point and observer does the colour house work to, and was the build pack's `#0B1F4B` → Lab
example measured or computed?**
Today: ΔE ≤ 1.5 is defined against our own sRGB / D65 / 2° figures and the package README says so. It changes
nothing we generate, only what a ΔE of 1.5 means.
Your answer: ______

**27. Can the factory hold ΔE CMC(2:1) ≤ 1.5?**
Today: 1.5 is seeded from rule R-SUB-005, which itself asks the factory to confirm what they can hold.
Your answer: ______

**28. Will the print house give us an ICC profile for the sublimation gamut?**
Today: Brand Studio shows Knitwright's own chroma estimate. Same as question 17 of the 2026-10-25 sheet.
Your answer: ______

**29. Licence the Pantone TCX library, or keep asking brands to read their printed swatch book?**
Today: no Pantone data ships; a brand types its own TCX codes and nothing is matched for it.
Your answer: ______

**30. Which kit fonts should be licensed, and for which use (screen, sublimation print, the factory's RIP)?**
Today: only the two bundled Geist faces have a licence we can show; four placeholders say no licence is on file.
Your answer: ______

**31. Will the factory give a standard chest-sponsor and crest width per article?**
Today: none in the rulebook, so the DPI check needs a brand to type a width.
Your answer: ______

**32. Does the factory need the DXF geometry to carry its notch style, or is the style stated in the README and the
1:1 PDF enough?**
Today: one style, stated, v-notch in the package (decision 17).
Your answer: ______

---

## C. Sizing, measurement and the article data (33 to 45). Most of these are the factory's pattern master's.

**33. Does the factory's shirt-tail block use a flatter or a fuller hem curve than a symmetric one?**
Today: both drop-tail control fractions are seeded at 0.5. At a zero drop tail the answer changes nothing.
Your answer: ______

**34. What negative ease does the factory's 1x1 rib cuff take, and is it millimetres or a ratio of the opening?**
Today: 20 mm, with no source in the pack.
Your answer: ______

**35. Is the cuff cut to POM F (the finished opening), or to the sleeve edge it is sewn to, less the ease?**
Today: POM F, which stretches the rib ~11 mm more at size M.
Your answer: ______

**36. Does the factory want a notch at the cuff's underarm seam?**
Today: none; the rulebook quarters the neck rib and says nothing about a cuff.
Your answer: ______

**37. Size range, sample size, fit and gender for the seven draft articles — and is `JSY-SS-01` men's, women's or
unisex?**
Today: none are set, and the catalogue says gender is not set on any base article.
Your answer: ______

**38. Is 3 to 9 in the factory's inseam range for `SHO-TR-01`, and in what step?**
Today: the build pack's own rule R-SHO-002, with no step, no default and no factory approval; nothing offers it.
Your answer: ______

**39. Option codes for the shorts' waistband, side split and pocket?**
Today: the groups are named, the codes do not exist, so none can be offered.
Your answer: ______

**40. What is each of the seven articles, exactly?** (`JSY-LS-01` also the goalkeeper shirt? `CRK-SS-01` a placket
and its own collar group? `HOD-ST-01` pullover or zip? `CMP-LS-01` the same as the rash guard, and with what block
and negative ease? What sews `FSH-MM-01`, the only woven garment?)
Today: one draft article each, empty POM table, "not drafted yet".
Your answer: ______

**41. Sport tags for `JSY-LS-01` and `HOD-ST-01`?**
Today: neither appears under any sport filter; the template library implies football and training.
Your answer: ______

**42. When will the factory send, per article: the pattern, the size chart, the POM table with grades and
tolerances, the construction table, seam allowances and thread, and the fabric's real code, weight and blend?**
Today: none on file, so no article may go `live` and a POM with no tolerance is refused.
Your answer: ______

**43. Where does the body size chart live, and who supplies it?** A catalogue table per size standard, shared
between articles, or a block on the base article? Today: nowhere; the Body tab asks for the numbers.
Your answer: ______

**44. Is "Fixed" a fourth grade type for good?**
Today: yes, as `article.json` uses it; the spec's tab shows three.
Your answer: ______

**45. Is a `crew-tee` design really a `TEE-TR-01`, and should fight shorts get a garment type of their own?**
Today: the map is one way and an uncovered type keeps the "article not set" warning.
Your answer: ______

---

## D. Factory terms, dates, markets and the Class B programme (46 to 61)

**46. How many working days from ready-for-QC to the carrier, and how many freight days to the UK and to
Australia, per carrier and service?**
Today: both unset, so **no page shows a delivery date** — each one names what is missing. The lead time is seeded
at 8 working days, labelled. Same as question 5 of the 2026-10-25 sheet.
Your answer: ______

**47. What is the real Class B quantity range per style, if any?**
Today: 50 to 300 is shown as a flag the brand may read and proceed past, not a refusal. (The person's look before
a Class B run is a separate, settled gate and is not in question.)
Your answer: ______

**48. Which factory makes which article, and with which fabric?**
Today: one placeholder factory row, and the id handed to production is still `knitwright-default`. Same as question
7 of the 2026-10-25 sheet.
Your answer: ______

**49. Is a sample three sizes at one piece each?**
Today: a fourth size is refused, from the spec.
Your answer: ______

**50. What evidence must a golden sample carry, and may anyone but the founder sign one off?**
Today: a photo and at least one measurement are required, a ΔE reading is not, and any member who may manage the
kit may sign off. A sign-off is what makes a run possible.
Your answer: ______

**51. Is a colour or artwork change surface enough to carry a sign-off forward without a new sample?**
Today: yes for fields labelled `surface`; an unknown field counts as structural, and the carried-over row says the
colour readings were taken on the parent's colours.
Your answer: ______

**52. Which decoration does the Class B stock-colour programme use, and what are its print rules?**
Today: `TEE-TR-01` and `HOD-ST-01` have no print, label, QC or cost rule at all.
Your answer: ______

**53. How long should a factory job-packet link last?** Today: 28 days, a labelled default.
Your answer: ______

**54. One link per batch, or one per factory?** Today: per batch, which keeps a leak to one batch.
Your answer: ______

**55. Should a factory's reply name the person who pressed it?** Today: it does not, so the scorecard cannot tell
two people at one factory apart.
Your answer: ______

**56. Who owns the WhatsApp Business number, and do we apply for a template message?** Today: no number is
seeded; outside a 24-hour window Meta refuses plain text, and ops would copy the link by hand.
Your answer: ______

**57. May the factory see prices?** Today: no — pieces, sizes, names and the BOM only.
Your answer: ______

**58. Are the factory's photos kept forever?** Today: no retention rule; nothing deletes them.
Your answer: ______

**59. Weekly Class A slot capacity in pieces, and which fabric weights, blends and stock colours are confirmed?**
Today: capacity not set, every fabric figure a build-pack placeholder, stock colours black / white / navy.
Your answer: ______

**60. VAT, low-value thresholds, HS codes and duty for GB and AU?**
Today: GB 20% / £135 / DCTS and AU 10% / A$1,000, public figures to confirm with a customs adviser; no HS codes.
Your answer: ______

**61. Which certifications does the factory hold (OEKO-TEX, GRS, BSCI), with what expiry, and should an expired one
stop an order?** Today: none seeded.
Your answer: ______

---

## E. Legal, labelling and moderation policy (62 to 68)

**62. The care wording per destination market — fibre, care and origin.**
Today: it exists nowhere in the build pack, the rule has no text, the market rules carry none, and the production
package gate refuses every real package partly because of this.
Your answer: ______

**63. The AQL plan per factory.**
Today: a Knitwright-made Class A sample inspects every piece; a partner's sample uses the plan on the input, and no
plan is on file. Same as question 25 of the 2026-10-25 sheet.
Your answer: ______

**64. What happens at three upheld notices — a warning, a stop on new orders, or an account closed — and who
decides?** Today: three is the seeded threshold and nothing acts on it.
Your answer: ______

**65. Who is the lawyer, and what address do takedown notices go to?**
Today: the report form and takedown flow were written without a lawyer's eye and say so.
Your answer: ______

**66. Is a picture still waiting for the content review a warning or a blocker, and does a Class B review look at
the design version only or at every picture in it?**
Today: nothing at save time, `not_screened` at order time — two answers about the same picture.
Your answer: ______

**67. Should the offensive-word list be reviewed by somebody, and may a club ask for a word to be allowed for its
own name?** Today: seeded data, nothing can be allowed per club.
Your answer: ______

**68. Can you give me a set of real uploads, good and bad, with what each should and should not match — and which
vision model should the check use, on every upload or only on artwork meant to print?**
Today: the distances and the detail floor are guesses, and the check is a paid call per upload.
Your answer: ______

---

## F. Rules, sources and the wording on screens (69 to 87)

**69. Is `knitwright` the right source for a rule we drafted and asked the factory to confirm, or should there be a
kind that says so?** Today: eight rules moved off `factory` because their notes only ask the factory something.
Your answer: ______

**70. Is `R-CON-010` spoken for?** Today: unassigned; the build pack uses 011 and the worked article ends at 009.
Your answer: ______

**71. What should the rulebook entry for the pattern fills `P00` to `P02` say?** Today: no rule, so they carry the
gap id.
Your answer: ______

**72. Must a version be accepted for ordering before it can be ordered?** Today: no; a validated version may be
ordered straight away.
Your answer: ______

**73. Who may accept a version for ordering — any member, or only an owner or admin?** Today: any member.
Your answer: ______

**74. Should a validated version go back to draft when the factory profile it was judged against changes?**
Today: it does not.
Your answer: ______

**75. Eight colours and 60 printed characters (the export format) or 48 and 80 (the editor)?** Today: they
disagree.
Your answer: ______

**76. Is "Not yet sampled" a warning or a lock on an option?** Today: a warning; a lock would disable every option
of every article until golden samples exist.
Your answer: ______

**77. The auto-name's wording, and should it replace the typed design name?** Today: "Crew neck · Coverstitch hem ·
Plain · Body length +20 mm", sitting under the typed name.
Your answer: ______

**78. Does the editor need its own credits counter?** Today: no; the studio header shows one.
Your answer: ______

**79. Should the tech pack's Review tab show the four items it cannot read (gamut, resolution, bleed, moderation)?**
Today: it shows them, so a founder does not read five items as the whole list.
Your answer: ______

**80. Does the body size chart get its own PDF page (seventeen pages), or stay on page 1?** Today: page 1, and the
workbook sheet carries a sentence rather than numbers.
Your answer: ______

**81. Does a factory want "Page 4 of 16" in the header as well as the footer?** Today: the title only.
Your answer: ______

**82. Should pages 2 and 3 be the same two drawings twice (flat, then colourway)?** Today: yes, as the spec lists
them.
Your answer: ______

**83. Who numbers the construction callouts on the flat?** Today: nobody; only the lettered points of measure
exist.
Your answer: ______

**84. Which image sizes does a factory or a marketplace want?** Today: 600 / 1200 / 2048 px, 1200 recommended,
none of them asked for.
Your answer: ______

**85. Should the catalogue gain a created date and a use count** (for Newest, Most used and a NEW tag)? Today:
neither exists, so the sort is the seeded order.
Your answer: ______

**86. Where should "From your crest or logo" go until crest-to-kit is built?** Today: `/club`, whose Club kit
section puts a crest, colours and sponsors on a design.
Your answer: ______

**87. Should the fabric programme gain a rib row for `F-POLY-RIB`?** Today: the rib is in the article but not in
the programme, so its card has only the article's own sentence.
Your answer: ______

---

## G. What merged while this sheet was being written (88 to 96)

**88. Do we apply for both Unsplash and Pexels, or run one?** Today: the code is ready for both behind their keys;
Unsplash's free tier is 50 requests an hour and its production tier needs their approval.
Your answer: ______

**89. Do we apply for Pinterest Standard access now?** Today: without it, boards are a demo for your own account.
Your answer: ______

**91. Should the inspiration board fetch a product page at all, or leave page fetching to the benchmarks feature?**
Today: it fetches once for the Open Graph words and keeps nothing; the benchmark fetcher will be a second one.
Your answer: ______

**92. Sixty items a moodboard, two seconds a source, twelve tags a query — keep them?** Today: Knitwright defaults,
none measured.
Your answer: ______

**93. Is the safe zone 10 mm or 15 mm?** Rule R-SUB-004 says a critical element keeps 15 mm from a seam; the
platform's own guardrail is a 10 mm Knitwright default and the 2D view draws the setting while naming that rule.
**The two disagree today.** Reseed to 15 mm, or tell me where the 10 mm came from.
Your answer: ______

**94. Which decoration methods does each factory run?** Today: heat transfer, screen print and embroidery are
locked, so sublimation is the only method offered.
Your answer: ______

**95. Should a pattern fill hold a tile width and height, padding and rotation?** Today: one size, plus spacing for
dots; the rest are listed as gaps.
Your answer: ______

**96. Should a graphic's placement be gradable per design, or does the base article always decide?** Today: the
article decides.
Your answer: ______

(Question 90, the price of a mood image, is in section A with the other money questions. The Pantone licence that
Y3's Colours section also needs is question 29.)
