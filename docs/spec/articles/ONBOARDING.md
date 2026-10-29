# Base article onboarding

This is the process for putting one product on the platform. Do it once per base article; `JSY-SS-01/` is the worked example.

A **base article** is one garment block the factory has proven: pattern, grading, construction, fabric and price. Customers never see "base articles"; they see endless products, because each base carries:
- options (collars, cuffs, hems);
- parameter ranges (lengths, drop tail);
- unlimited sublimated designs and colourways.

## How many base articles

**Eight at launch, added in three waves.** That is enough to cover teamwear and a credible first brand collection, and few enough that every base gets a real sample round and QC history.

| Wave | When | Code | Article | Class | Serves |
|---|---|---|---|---|---|
| 1 | Phase 0 (Nov–Dec 2026) | `JSY-SS-01` | Short-sleeve jersey, set-in sleeve | A | Teamwear + Studio |
| 1 | Phase 0 | `SHO-TR-01` | Football/training shorts | A | Teamwear + Studio |
| 2 | Phase 1 (Dec 2026 – Feb 2027) | `JSY-LS-01` | Long-sleeve jersey / goalkeeper | A | Teamwear + Studio |
| 2 | Phase 1 | `CRK-SS-01` | Cricket coloured shirt (pique) | A | Teamwear |
| 2 | Phase 1 | `TEE-TR-01` | Training tee, stock-colour fabric | B | Teamwear + Studio |
| 2 | Phase 1 | `HOD-ST-01` | Hoodie, stock-colour fleece | B | Teamwear + Studio |
| 3 | Phase 2 (Feb–May 2027) | `CMP-LS-01` | Compression top / rash guard | A | Studio |
| 3 | Phase 2 | `FSH-MM-01` | Fight shorts (MMA/BJJ) | A | Studio |

**What one base already covers:** `JSY-SS-01` alone gives 3 collars × 2 sleeve finishes × body-length, sleeve-length and drop-tail ranges × any print. That is a football shirt, a training top, an esports jersey and a running tee.

**When to add a new base instead:** when the change alters the block itself, for example a raglan sleeve (`JSY-RG-01`), a women's fit (`JSY-SW-01`), kids sizes (`JSY-SS-K1`) or a different fabric family. A new sleeve construction or a new size range is always a new base.

**Rule for adding more after launch:** add a base only when customers have asked for it at least 10 times, or a club or brand order of 50+ pieces needs it.

## The 9 steps (repeat for every article)

| # | Step | Who | Output | Typical time |
|---|---|---|---|---|
| 1 | **Brief.** Copy the `JSY-SS-01` folder, rename it with the new code, and edit `article.json`: sizes, POM table with grades and tolerances, options, fabric, construction, BOM, placements | Knitwright | `article.json` v0.1 | 1 day |
| 2 | **Factory master.** Ask the factory for their existing pattern and size chart for this garment (photos of the CorelDRAW screen or the DXF). Where they differ from your draft, **use the factory's values** | Founder + factory pattern master | `article.json` v0.2 matching the factory block | 2–3 days |
| 3 | **Draft pattern.** Run the pattern generator. Check `pattern-report.md`: every row OK, sleeve-cap ease 0–6 mm, rib length sensible | Knitwright (Claude Code can run it) | `pattern/` SVG + DXF per size, graded nest, report | 1 hour |
| 4 | **Tech pack v0.2.** Update the tech pack pages from `article.json`. Send the tech pack, the size-M SVG/DXF, the nest and the rulebook to the factory | Knitwright | Factory review packet | 1 day |
| 5 | **Factory review.** The pattern master overlays our size-M pattern on their master and notes any difference over 2 mm. The production manager fills the shaded cells (supplier codes, consumption, prices, lead times) and page 17 | Factory | Marked-up tech pack + sign-off page | 3–5 days |
| 6 | **Sample round.** Revise to v0.3, then the factory prints a strike-off and sews sizes S, M and XL in one test design | Factory | 3 samples + strike-off | 7–14 days |
| 7 | **Measure and approve.** Measure every POM on the 3 samples, read ΔE against the strike-off, and fill the sample table on page 17. If any POM is out of tolerance, fix the pattern and repeat step 6 for that size. When all pass, photograph the **golden sample** | Founder (with tape measure and colour reader) | Golden sample record; v1.0 | 2–3 days |
| 8 | **Rulebook confirmed.** Walk the factory through every rulebook entry. Change anything they do differently, add what's missing, and initial each row. Status becomes `confirmed` | Founder + pattern master + production manager | `rulebook.md` v1.0 | 1 day |
| 9 | **Platform assets.** These make the base usable on the platform: <ul><li>3D model (glTF) built from the approved pattern, with UV islands equal to the panels (contract 3D artist);</li><li>production parametric script matching the approved pattern within 2 mm (Claude Code);</li><li>option thumbnails;</li><li>price tiers and capacity in the factory profile;</li><li>parameter ranges marked `approved` only where a sample at the range end exists.</li></ul> | Knitwright | Base article live | 1–2 weeks |

**Total: about 3–5 weeks per article.** Several articles can run in parallel once the first one has been through the process. Steps 6–7 are the slow part.

**Costs per article to plan for:**
- sample sewing: 3 sizes × the factory's sample price (supplier listings show $25–80 per sample);
- one strike-off;
- courier;
- the 3D model (get quotes from 3D artists; it is a one-off per base).

## Go-live checklist (all must be true)

- [ ] `article.json` is v1.0 and every value matches the approved golden sample
- [ ] `pattern-report.md` shows OK on every row for every size
- [ ] Factory overlay shows no difference over 2 mm on size M
- [ ] Samples S, M and XL are within tolerance on every measured POM
- [ ] ΔE on every colour role is within the tolerance on page 17
- [ ] Tech pack has no blank or TBC values (supplier codes, consumption, prices, lead times)
- [ ] Page 17 is signed by the pattern master, the production manager and Knitwright
- [ ] Rulebook is v1.0 with every row confirmed and initialled
- [ ] Every validation check, option and tech-pack field in the platform has a `rule_id` that exists in the rulebook
- [ ] 3D model passes the UV check (each panel one island, stretch under 5%)
- [ ] Production parametric script matches the approved pattern within 2 mm (golden test)
- [ ] Price tiers (1 / 50 / 100 / 300), lead times and weekly capacity are entered in the factory profile
- [ ] Golden-sample photos are uploaded (front, back, neck, seam, labels)
- [ ] Label wording is confirmed for the UK (and Australia when it opens)

## Folder template

```
articles/<CODE>/
├── article.json              # the single source of truth for this base
├── rulebook.md               # article rules + links to shared R-SUB / R-LAB / R-QC / R-COST rules
├── pattern/                  # generated: <CODE>_<size>.svg/.dxf, <CODE>_nest.svg, pattern-report.md
├── techpack/<CODE>_techpack.html   # print to PDF; page 17 is the factory sign-off
├── samples/                  # photos and measurement sheets from each sample round (add yourself)
└── tools/                    # review-draft generator (production uses the files service)
```

## Message to send the factory with the review packet

> Assalam o Alaikum. Attached is our tech pack and pattern for the short-sleeve sublimated jersey (JSY-SS-01, draft v0.2). Please:
> 1. Compare our size-M pattern with your master and tell us any difference over 2 mm.
> 2. Fill in the shaded boxes (fabric supplier, consumption, prices for 1/50/100/300 pieces, lead times).
> 3. Check page 10: which print file format, DPI and colour profile do you prefer?
> 4. Sign page 17 or write the changes you want.
>
> After that we would like to order one strike-off and samples in S, M and XL. Thank you.
