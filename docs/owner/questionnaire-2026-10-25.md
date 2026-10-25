# Knitwright platform: questions for the owner, with suggested answers

Written 2026-10-25, after waves 1 and 2 of plan v4 (`plans/platform-v4.md`) were merged.

**How to use this.** Each question has the answer I suggest. Where you agree, write `OK` in the
"Your answer" line. Where you disagree or know better, write your answer. You can answer in any order; the
**Do first** list is the shortest path to a launch-ready platform.

**How to read the suggestions.** I am not a factory, a print house or a lawyer. Each suggestion says what it is
based on:

- **Spec**: the Knitwright product spec (2026-10-22) says it.
- **Industry**: ordinary practice in apparel or sublimation, from my general knowledge. Check it with your factory.
- **My judgement**: a sensible default I chose; it has no outside support.
- **Today**: what the platform does now, as a labelled placeholder. Keeping it is a valid answer.

Nothing here has been checked with a factory, a print house or the Australian partner. Every number in a
suggestion is a starting point to confirm, not a fact.

**What your answers change.** Each answer replaces a labelled placeholder in the platform. After you answer, a
platform admin can enter factory and credit values in the settings screen (wave 3 builds it), or I change the
default in code. Nothing is blocked while a question is open; the platform shows "Knitwright default, not agreed
with a factory" until you answer.

---

## Do first (the 12 that matter most)

| # | Question | Suggested | Section |
|---|---|---|---|
| 1 | Credit prices | media set 5, tech pack PDF 2, pattern files 3 | A |
| 4 | Price ladder and MOQ per article | Ask both factories for quotes at 10/20/50/100 pieces | B |
| 6 | Weekly batch cut-off | Friday 12:00 Pakistan time | B |
| 7 | Factory per article | One primary factory; socks and caps wait for a knitting factory | B |
| 9 | Australian winter code | AFL, shirts only first | C |
| 17 | Print house ICC profile | Request it; keep sRGB until it arrives | D |
| 13 | Bleed | 15 mm everywhere | D |
| 20 | Fabric.js for panel layers | Adopt for panels only | E |
| 24 | Couriers | Typed tracking now; DHL Express API later | F |
| 25 | Acceptable defect rate | Industry AQL 2.5 for major defects; zero for critical | F |
| 31 | Approve the 200 intake prompts | Approve after a 30 minute skim | G |
| 36 | Pattern technician who reviews blocks | The Sialkot pattern master | H |

---

## A. Credits

Credits are the product's currency for paid outputs (marketing media, full tech pack PDF, pattern files). The
ledger and the gate are built. The gate is switched off (`CREDITS_ENFORCED`) until you answer 1 to 3.

**1. What does each paid output cost in credits, and what is a credit worth?**
Today: 1, 1 and 1 credit; 10 free credits a month. All placeholders.
Suggested: media set (4 images and 1 clip) = **5**, full tech pack PDF = **2**, pattern files for one article = **3**;
a credit sells for about **$0.30**; 10 free credits a month.
Basis: *My judgement, from the spec's unit costs*: about $0.70 of compute for a media set with try-on and a clip, so
5 credits (about $1.50) is roughly twice cost; the tech pack and pattern files cost almost nothing to make, so they are
priced by value, not cost. Selling credits is the Store's job, not this platform's.
Your answer: ______

**2. When a design is ordered, are the credits spent on it refunded?**
Today: yes, once, for every spend on that design version.
Suggested: **keep it.** Basis: *Spec*: "credits spent on a design are refunded when that design is ordered fulfilled by Knitwright."
Your answer: ______

**3. How many free credits does a brand get each month, and do unused credits roll over?**
Today: 10 a month, no rollover.
Suggested: **10 a month, no rollover.** Basis: *Today*; enough for two media sets a month, so free users can try the
loop. A competitor in the spec (Fash Studio) also does not roll over.
Your answer: ______

---

## B. Factory data (blocks an order being accepted as "ready for the factory")

**4. What are the minimum order quantity and the price at each quantity, for each article?**
Today: not set. No price is shown anywhere.
Suggested: ask both Sialkot factories in writing for a unit price at **10, 20, 50 and 100 pieces** per article. Spec: minimum
first order **10 pieces**, no minimum on reorders of a saved design, brand runs **50 to 300**. Until quotes arrive, leave
"not set"; do not guess prices.
Basis: *Spec* (the quantities, and the open question "sub-100 MOQ in writing from each factory"). For reference, the
spec's competitors: owayo $89 at 1 piece, $56 at 20, $42 at 100.
Your answer: ______

**5. What is the lead time, and does it differ by article?**
Today: not set, so no order has a promised date.
Suggested: **10 working days in production, about 21 days door to door** for every article, until a factory says otherwise.
Basis: *Spec*: "8 to 12 working days" production and "about three weeks door to door".
Your answer: ______

**6. When is the weekly batch cut-off, in which time zone?**
Today: Friday 17:00 UTC (10 pm in Sialkot), a placeholder.
Suggested: **Friday 12:00 Pakistan time**, so the batch reaches the factory the same day and production starts Monday.
Basis: *My judgement*: 17:00 UTC is after the factory's working day.
Your answer: ______

**7. Which factory makes which article, and with which fabric?**
Today: unassigned; the Store would pass a factory profile id as text.
Suggested: **one primary sublimation cut-and-sew factory for every shirt, short, trouser and training top.**
Hold **socks and caps** (the spec lists both) until you find a factory with knitting or cap capacity; show them as "coming soon" in
the catalogue rather than offering them.
Basis: *My judgement*; the spec says "knitting programme not supplied" for socks, and the platform already says "No pattern yet" for gaps.
Your answer: ______

**8. Swatch book: which fabrics, and who measures the printed colour against the screen?**
Today: not set; no colour accuracy is claimed anywhere.
Suggested: one swatch per base fabric, printed at the factory, measured by the **Sialkot QC person with a handheld spectrophotometer**
against the sRGB value. Accept a CIEDE2000 difference of **4 or less** at launch and tighten to 3 once you have data.
Basis: *Industry* (textile colour tolerances are usually in the 2 to 4 range; check what your printer holds). The spec says a
physical swatch book per fabric is part of launch.
Your answer: ______

---

## C. Products and sizes

**9. Which Australian winter code launches, and do clubs order shirts only or full kits?**
Today: an empty slot "Team top, winter code"; three intake prompts expect it.
Suggested: **AFL, shirts (guernseys) only first.** Ask the Australian partner which codes their clubs actually order; if they
say netball or rugby, swap the code before building more for it.
Basis: *My judgement*; the spec leaves it to the partner (AFL, rugby league, rugby union, netball).
Your answer: ______

**10. What do we do about socks and caps?**
Suggested: keep the articles in the catalogue as definitions, but do not offer them until a factory is found (question 7).
Your answer: ______

**11. Which patterns do we use for products the pattern drafting service cannot draft (football shorts, singlet, hoodie, track jacket, raglan jersey)?**
Today: "No pattern yet".
Suggested: ask both factories for their graded size-M to 3XL patterns first (the spec's first option). If they will not
share them, buy **one month of Tailornova ($79, per the spec)** to bootstrap the launch articles, and have the factory confirm each.
Basis: *Spec*.
Your answer: ______

**12. Australian sizes: which labels, and which pattern size is each cut from?**
Today: starter charts and a suggested label map, marked as suggested.
Suggested: adult **XS to 5XL**, youth **sizes 4 to 16** (even numbers), each label cut from the nearest pattern size, and the Australian
partner supplies the size table clubs already use.
Basis: *Industry* (common Australian teamwear labels); the partner's table should win.
Your answer: ______

---

## D. Print house and file rules

**13. What bleed do print files carry?**
Today: **two defaults disagree**: the editor checks use 10 mm; the print file profile uses 15 mm.
Suggested: **15 mm everywhere.** Basis: *Industry* (15 mm matches the sublimation benchmark we studied); *Today* for the print profile.
I will make the editor match your answer.
Your answer: ______

**14. What is the minimum resolution for artwork?**
Today: warning below 150 dpi at print size.
Suggested: **warn below 150, block below 100** effective dpi at the printed size; line art stays vector. Basis: *Spec* (150 dpi print files),
*My judgement* for the block level.
Your answer: ______

**15. How much clear space around names and numbers?**
Today: 10 mm from seams and edges; no league rules.
Suggested: **keep 10 mm.** League number heights and sleeve badge rules are set per competition; collect them from the Australian partner's leagues.
Your answer: ______

**16. Should artwork that crosses a seam block an order?**
Today: a warning only.
Suggested: **warn for ordinary artwork; block when a crest, sponsor logo, name or number crosses a seam.** Basis: *My judgement*.
Your answer: ______

**17. Does the print house supply an ICC profile, and what colours does it say sublimation cannot hit?**
Today: an approximate gamut estimate, labelled as an estimate.
Suggested: **request the print house's ICC profile for your ink, paper and press.** Until it arrives, keep the labelled estimate.
Your answer: ______

**18. Which fonts for names and numbers?**
Today: one bundled font (Geist); players get no choice.
Suggested: bundle **3 open-licence (SIL OFL) sports fonts**: Bebas Neue (numbers), Oswald and Barlow Condensed (names); let clubs upload their
own later with a "I hold the licence" tick. Basis: *Industry* (OFL fonts may be embedded in print files without a fee); check each font's
licence file when added.
Your answer: ______

**19. Does the platform support Pantone?**
Today: no Pantone data; colours show as hex and a factory colour code.
Suggested: **not at launch.** The spec wants "hex and nearest Pantone"; licensing Pantone's colour data has a cost and terms I have not checked, so decide
whether a clearly labelled "nearest Pantone, indicative" is worth that cost. Basis: *My judgement*.
Your answer: ______

---

## E. Studio

**20. Fabric.js for the panel layer editor: go ahead?**
Today: a decision record and a flagged prototype exist (`docs/decisions/0053`); the real editor is unchanged. Its recommendation is
"adopt for panels only".
Suggested: **yes, adopt for panels only,** keep the current renderer for flats and the tech pack, and build seam-crossing overlays before text on a path.
Read the measured bundle impact in the decision record first; if it is too heavy for phones, say so and I extend the current renderer instead.
Your answer: ______

**21. Text on a path needs a new artwork version. Accept that?**
Suggested: **yes,** a new stack version with the font list from question 18. Basis: *My judgement*.
Your answer: ______

**22. Raster logos to vectors: what quality bar, and is an open-source tracer acceptable?**
Suggested: **use a permissively licensed tracer (for example VTracer, MIT)** and flag results below a quality bar for a person to review; never claim a trace
is exact. Avoid GPL tools (such as Potrace). Basis: *Industry*; I have not tested VTracer on your logos.
Your answer: ______

**23. How many inspiration variants, and should designs with blockers still show them?**
Today: 10, and yes (only variants with new blockers are dropped).
Suggested: **keep both.** The spec says 8 to 12; fixed at 10 keeps the screen calm.
Your answer: ______

---

## F. Operations (the ops console)

**24. Which couriers, and do you want label booking and tracking links through their API?**
Today: courier and tracking number are typed in by hand.
Suggested: **typed tracking for the first 15 orders,** then connect **DHL Express** (the spec says express courier) once you know the real volumes.
Basis: *My judgement*; the spec's Phase 1 goal is 15 paid orders.
Your answer: ______

**25. What defect rate fails a QC check?**
Today: zero (one defective piece in the sample fails the order).
Suggested: **no critical defects; accept major defects up to AQL 2.5 and minor up to AQL 4.0** on the sampled pieces; the spec targets an overall
defect rate under 2%. Basis: *Industry* (AQL 2.5/4.0 is the usual apparel inspection setting); agree it with each factory.
Your answer: ______

**26. Who supplies the points of measure and the tolerance for each article?**
Today: the inspector types them on every line.
Suggested: **take them from the tech pack's own measurement table and its tolerances,** so QC compares like with like. Basis: *Spec* (the tech pack is a view of the design).
Your answer: ______

**27. How are remakes sent to the factory?**
Today: a remake line appears on screen only.
Suggested: **print remake lines on the next batch's factory sheet and send the sheet as usual;** the factory never logs in. Basis: *Spec*.
Your answer: ______

**28. Should clubs see their tracking number and shipped date, and should `shipped` be its own status?**
Suggested: **yes to both.** Basis: *Spec* ("tracking on the club page").
Your answer: ______

**29. Packing rules.**
Suggested: **one labelled bag per player, cartons no heavier than 20 kg,** until the factory and courier set limits. Basis: *Industry*; confirm with the courier.
Your answer: ______

**30. How does the factory receive the batch sheet?**
Today: nothing is sent; a person downloads it.
Suggested: **an expiring download link, emailed by an ops person for now.** Automate after the first 15 orders. Basis: *Spec* (the factory never has a login).
Your answer: ______

---

## G. Intake and AI

**31. Approve the 200 test prompts?**
Today: proposed, not approved. First look at: "rashie", "bibs", and any prompt where two articles could be right.
Suggested: **approve after a 30 minute skim,** then replace 50 to 100 of them with real messages from the Australian partner's clubs.
Your answer: ______

**32. Is the 95% target over all 200 or only over what the catalogue can answer?**
Suggested: **require 95% on prompts the catalogue can answer, and 100% that nothing is created outside the catalogue,** and report both numbers.
Basis: *Spec* ("nothing is created outside the catalogue").
Your answer: ______

**33. Which model do we test with, and what spend limit?**
Today: no live run; cap $0.50 per run.
Suggested: **a small Claude model (the spec says Haiku class), cap $1 per run.** The spec puts it near $0.0004 a call, so 200 prompts should cost well under $1.
Your answer: ______

**34. Jersey photos for the picture test.** About 20 photos of real kits with the article and colours read by a person.
Suggested: **ask the Australian partner for 20 photos from their clubs,** with permission to use them for testing.
Your answer: ______

**35. Design from a picture: privacy wording, and the price cap per picture.**
Today: off; draft wording in `docs/data-processing.md`.
Suggested: **have a lawyer review the wording before switching it on,** cap at **about $0.02 per picture read** and **20 reads a day per brand.** Basis: *My judgement*.
Your answer: ______

---

## H. People, review and the Store boundary

**36. Who reviews each pattern block as a technician?**
Today: every pattern says "Draft pattern, not reviewed".
Suggested: **the Sialkot pattern master,** signing in the platform with a name and date. Basis: *My judgement*.
Your answer: ______

**37. Fabric test values from the mill: stretch at load, recovery, sublimation shrink.**
Today: not set; print scale 1.0 with a margin note.
Suggested: **ask each mill or the print house for a test per base fabric** and enter it in the fabric library. Until then the files say "Not scaled for shrink".
Your answer: ______

**38. Who signs what (pattern, print, production, club)?**
Today: any member can sign with a role they type.
Suggested: **named roles:** pattern technician (factory), print (print house), production (Knitwright ops), club (club admin).
Your answer: ______

**39. Does your Store use `submit_order_for_production`?** The ops console takes an order from the Store through one documented function (decision 0043).
Suggested: **give that decision record to whoever builds the Store** and ask them to confirm the fields (release id, factory profile id, fabric key, quantities, promised date).
Your answer: ______

---

## I. Clubs and templates

**40. Who can add templates?** Today: a seed script. Suggested: **platform admins only,** through the wave 3 settings screen later. Your answer: ______

**41. Which real kits should the first reviewed templates be?** Suggested: **10 kits from the Australian partner's clubs,** reviewed by the factory. Your answer: ______

**42. When do designers submit templates?** Today: reserved and off. Suggested: **Phase 4 (May to July 2027), with a royalty per unit,** reviewed by your contract designer. Basis: *Spec*. Your answer: ______

**43. Should a template use the club's own colours when the club has set a kit?** Suggested: **yes, with a "use club colours" switch that defaults on.** Your answer: ______

**44. Should football and cricket articles get kit patterns (hoops, stripes, sash)?** Suggested: **yes, it is the most requested club style;** it needs a change to the kit pattern families and the flats. Your answer: ______

**45. Roster fields: date of birth for junior age groups?** Suggested: **no date of birth;** store an optional **age group** (for example U12) so the platform holds less data about children. Basis: *My judgement* (privacy). Your answer: ______

**46. Club roles: is "a kit manager cannot change members" what clubs expect, and may a viewer see order history?** Suggested: **yes to both,** viewers read only, and never see player names beyond their own club's rosters. Your answer: ______

**47. Club invitations by email: which provider?** Suggested: **Resend** (the launch checklist already lists it). Your answer: ______

**48. When do small brands get their "product list" workspace?** Suggested: **after clubs are live,** in the next wave. Basis: *Spec* (clubs first, small brands second). Your answer: ______

---

## Items from 2026-10-15 that are still open

The file `docs/owner/open-decisions-2026-10-15.md` (P1 to P17 and A5) is still current for anything not repeated above. The ones that
matter most there are P1 (question 36), P4 (37), P5 and P14 (print house rules, 13 to 17), P10 (38), P12 and P16 (35).
Hosted-setup items are separate and unchanged: Vercel login, a hosted Supabase project, Resend, Google sign-in, a Turnstile widget.
