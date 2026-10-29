# Rulebook · JSY-SS-01 short-sleeve sublimated jersey

Version 0.1 · 25 Oct 2026 · status: **draft for factory review**

## How this file is used

**In the product.** This is the knowledge behind every "Why?" in the Studio (F-S5). Each entry becomes one `rulebook_entry` row. The AI may only explain what is written here; if a question isn't covered, it says so and the gap is logged.

**Each entry has:**
- **ID**: never reused; a changed entry gets a new version;
- **Applies to**: options, POMs or checks that link to it;
- **Rule**: what the system enforces;
- **Why**: one or two plain sentences a founder understands;
- **Best practice**: the advice shown in the Studio;
- **Source**: who confirmed it;
- **Status**: `draft` until the factory's pattern master and production manager initial it in the sign-off column.

**Shared rules.** The general rules (R-SUB, R-LAB, R-QC, R-COST) are shared by every sublimated article. Write them once and reuse them for the next products.

---

## Pattern (R-PAT)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-PAT-001 | All pieces | Seam allowance 6 mm on overlocked seams, 25 mm body hem, 20 mm sleeve hem, 6 mm on rib | A 4-thread overlock trims and sews about 6 mm; hems need room to fold and coverstitch | Never put critical artwork inside the seam allowance; it gets cut or folded away | Knitwright draft; factory to confirm their machine settings | draft |
| R-PAT-002 | Front, back, sleeves | Sublimated panels are cut flat, not on the fold, and left and right sleeves are separate pieces | Each panel is printed with its own artwork, so a folded or doubled cut would mirror or misplace the print | Design both sleeves; they can differ (e.g. a sponsor on one side only) | Sublimation practice | draft |
| R-PAT-003 | Parameter `body_length_offset` −30 to +40 mm | Body length can change in 10 mm steps within this range | Beyond this, the proportion of the block changes and the size chart no longer describes the fit | For tucked-in match shirts use 0 or +20; for training tops 0 or −20 | Knitwright draft; range approved only after a sample at each end | draft |
| R-PAT-004 | Parameter `sleeve_length_offset` −20 to +40 mm | Sleeve length can change in 10 mm steps within this range | Longer than +40 becomes a different sleeve (elbow length) and needs a new block | Goalkeeper or long-sleeve shirts use article JSY-LS-01, not this offset | Knitwright draft | draft |
| R-PAT-005 | Parameter `back_drop_tail` 0 to 40 mm | The back hem can curve down by up to 40 mm at centre back | A drop tail keeps the shirt tucked during play, but a longer tail needs a different hem operation | Use 20–30 mm for football match shirts | Knitwright draft | draft |
| R-PAT-006 | Notches | Front armhole: 1 notch; back armhole: 2 notches; sleeve: matching notches plus a top notch at the shoulder; CF and CB notches at neck and hem; rib quartered | Notches make the sleeve go in the right way round and stop panels being sewn twisted | Do not remove notches when editing patterns; the factory relies on them | Industry standard | draft |
| R-PAT-007 | Sleeve cap | Total cap length is 0–6 mm longer than the armhole | Knit fabric needs almost no ease; too much puckers the shoulder, too little pulls the sleeve | Checked automatically in every pattern report | Knitwright draft | draft |
| R-PAT-008 | Neck rib C01 | Rib length = neckline seam × 0.85 | A rib cut shorter than the neckline is stretched while sewing, so it lies flat and holds its shape | If the factory's rib is stretchier or tighter, adjust the ratio here and re-sample | Industry practice; factory to confirm with their rib | draft |

## Fit and grading (R-FIT)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-FIT-001 | POM A chest, K hem | Regular fit: chest half 520 mm at M, grading 30 mm per size, tolerance ±10 mm | A 104 cm finished chest on a size-M body (about 96–100 cm) gives movement room without flapping | Show customers the garment measurements, not only body sizes; it reduces wrong-size returns | Knitwright draft; replace with factory block values | draft |
| R-FIT-002 | POM B body length | 720 mm at M, +20 mm per size, ±10 mm | Long enough to tuck in, short enough not to bunch | Measure from the high point of the shoulder, front | Knitwright draft | draft |
| R-FIT-003 | POM C shoulder | 460 mm at M, +15 mm per size, ±7 mm | The shoulder seam should sit on the shoulder bone; too wide looks sloppy, too narrow restricts the arm | Shoulder grades less than chest because shoulders grow less than chests | Grading practice | draft |
| R-FIT-004 | POM D sleeve length | 210 mm at M, +10 mm per size, ±7 mm | Ends mid-bicep, the standard football look | Use the sleeve offset parameter for longer looks rather than editing the pattern | Knitwright draft | draft |
| R-FIT-005 | POM E bicep, F opening | Bicep 195 mm half at M, opening 170 mm half, both +10 mm per size, ±5 mm | Enough room for arm movement; the opening tapers so the sleeve doesn't flare | Tighter sleeves need fabric with stretch (rib cuff K02) | Knitwright draft | draft |
| R-FIT-006 | POM G armhole depth | 250 mm at M, +10 mm per size, ±7 mm | A deep armhole lets the arm lift without pulling the body up | Don't shorten it for a "tighter" look; it restricts movement | Knitwright draft | draft |
| R-FIT-007 | POM H, I, J neck | Neck width 180 mm at M (+5), front drop 85 mm (+3), back drop 20 mm fixed | The crew neck must pass over the head and sit flat, not choke or gape | V-neck C02 uses a 140 mm front drop | Knitwright draft | draft |
| R-FIT-008 | All POMs | Tolerances are checked on QC samples; a piece outside tolerance is a major defect | Tolerances are the promise to the customer that size M is always size M | Tighten tolerances only when the factory proves it can hold them | Industry practice | draft |

## Construction (R-CON)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-CON-001 | Shoulder, sleeve attach | 4-thread overlock (ISO 514), 12–14 stitches per inch | Overlock stitches stretch with knit fabric, so seams don't crack when the shirt is pulled on | Thread colour matches the dominant colour so seams don't show | Industry standard | draft |
| R-CON-002 | Back neck | The back neck seam is covered with tape and coverstitched | Covers the seam so it doesn't scratch, and stops the neck stretching out | Tape can be printed or contrast for a branded finish | Industry standard | draft |
| R-CON-003 | Side seams | One continuous overlock seam from body hem to sleeve hem, underarm seams matched | Faster to sew and stronger; matched underarm seams look finished | Allow artwork to wrap across the side seam only if a 3 mm offset is acceptable (R-SUB-004) | Industry standard | draft |
| R-CON-004 | Collar C01 | 1x1 rib, 20 mm finished, joined at CB, attached with overlock | Rib recovers after stretching over the head and keeps the neck shape | Rib can be sublimated in a club colour or left white | Factory to confirm rib source | draft |
| R-CON-005 | Collar C02 | V-neck with 15 mm self-fabric binding and a mitred V | A mitre gives a sharp V point that doesn't twist | V-necks need a centre-front notch and careful pressing | Factory to confirm | draft |
| R-CON-006 | Collar C03 | Crew neck with 15 mm self-fabric binding | Matches the body print exactly, a modern look | Binding must be cut across the stretch so it recovers | Factory to confirm | draft |
| R-CON-007 | Hems K01, body | 2-needle coverstitch (ISO 406), 6.4 mm gauge; sleeve 20 mm, body 25 mm | Coverstitch stretches with the fabric and looks clean on both sides | Don't use a single-needle lockstitch on knit hems; it snaps | Industry standard | draft |
| R-CON-008 | Cuff K02 | 1x1 rib cuff, 25 mm finished | Holds the sleeve close to the arm, a retro look | Rib cuffs add cost and a sewing step (R-COST-002) | Factory to confirm | draft |
| R-CON-009 | Thread | Needle: poly core-spun Tex 27; looper: textured poly Tex 18 | Polyester thread survives sublimation heat and washing; textured looper thread is soft and stretchy | Cotton thread is never used on polyester sportswear | Industry practice | draft |

## Sublimation and print (R-SUB), shared by all sublimated articles

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-SUB-001 | Fabric | Only white polyester-rich fabric (85–100% polyester) is sublimated | Sublimation dye only bonds with polyester; cotton and nylon don't take it and colours wash out | Want a dark base? Print it; the fabric is still white underneath | Process physics | draft |
| R-SUB-002 | Print files | 10 mm bleed beyond the cut line on every panel | Panels shift slightly when cut; bleed means no white edges | The editor adds bleed automatically; keep backgrounds running to the edge | Sublimation practice | draft |
| R-SUB-003 | Print files | 150 DPI at 1:1, sRGB, not mirrored; the factory's RIP mirrors for transfer paper | 150 DPI is sharp at viewing distance on knit fabric; higher only makes files larger | Upload vector logos (SVG/PDF) where possible; they stay sharp at any size | Factory to confirm their RIP settings | draft |
| R-SUB-004 | Seam crossings | Artwork that crosses a seam can be offset by up to 3 mm after sewing; critical elements keep 15 mm away from seams | Each panel is printed and cut separately, then sewn; sewing shifts panels slightly | Stripes across seams are fine if a small offset is acceptable; crests, numbers and text are not | Sublimation practice | draft |
| R-SUB-005 | Colours | Colours are checked against a printed strike-off; tolerance ΔE CMC(2:1) ≤ 1.5 | Screens can't show printed colour exactly; the strike-off is the truth | Pick club colours from the printed swatch book, not from the screen | Factory to confirm the tolerance they can hold | draft |
| R-SUB-006 | Fabric shrink | Panels are printed oversize to allow for heat-press shrink (placeholder 1.5% length, 1.0% width) | Polyester shrinks slightly in the press; without allowance the cut panels come out small | Shrink % is measured per fabric roll batch by the factory | Factory to measure | draft |
| R-SUB-007 | Fine detail | Minimum line 0.5 mm, minimum text 6 pt (2 mm cap height) | Knit fabric texture breaks up finer detail | Use bold fonts for small text | Sublimation practice | draft |
| R-SUB-008 | Black | Rich black is the factory's own black recipe, not 0/0/0 RGB | Pure black in RGB prints brown or grey on many setups | Use the "Kit black" swatch | Factory to confirm | draft |

## Personalisation (R-PER)

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-PER-001 | Back name | 60 mm cap height, top 70 mm below the back neck, max 12 characters | Readable from the stands and clear of the collar | Use surnames in capitals; long names shrink to fit the zone | Knitwright draft | draft |
| R-PER-002 | Back number | 220 mm high, top 150 mm below the back neck | Standard size for adult football; readable for referees | Children's sizes use 180 mm (kids article) | Common competition practice; check league rules | draft |
| R-PER-003 | Front number | 100 mm high, centre chest or wearer's right chest | Optional; must not clash with the crest and sponsor | Leave it off if there is a large main sponsor | Knitwright draft | draft |
| R-PER-004 | Method | Names and numbers are printed in the same sublimation pass | No extra layer to crack or peel, and no extra cost per piece | Outline colours improve contrast on patterned backgrounds | Sublimation practice | draft |

## Labels and compliance (R-LAB), shared

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-LAB-001 | Neck label | Heat-transfer or printed neck label; no sewn neck label | Sewn labels scratch during sport | Brands can add their logo to the neck print | Sportswear practice | draft |
| R-LAB-002 | Care label | Permanent care and fibre label in the wearer's left side seam, 80 mm above the hem, with fibre content, care, origin and size per destination market | UK and Australian law require fibre content and care information on the garment | Labels are generated automatically per market | UK Textile Products regulations; Australian care labelling standard. Confirm with legal consult | draft |
| R-LAB-003 | Finishes | Only PFAS-free finishes | PFAS ("forever chemicals") are being restricted in clothing in the EU and elsewhere | Ask the fabric mill for a PFAS-free declaration | Regulation trend; supplier declaration | draft |

## Quality control (R-QC), shared

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-QC-001 | Every order | Class A: every piece inspected. Runs: AQL 0 critical / 2.5 major / 4.0 minor at level II; measure POMs A, B, C, D, E, H, I | Catching a fault before shipping costs far less than a remake | Photograph front, back, labels and a seam close-up for every order | AQL standard (ISO 2859-1) | draft |
| R-QC-002 | Print alignment | Print across shoulder and side seams aligned within 3 mm | Misalignment is the most visible defect on sublimated kit | Check the side seams at the hem, where misalignment shows most | Knitwright draft | draft |

## Cost drivers (R-COST), shared

| ID | Applies to | Rule | Why | Best practice | Source | Status / sign-off |
|---|---|---|---|---|---|---|
| R-COST-001 | Sublimation | Full sublimation costs the same whether the design is plain or busy | The whole panel is printed either way | Use colour and pattern freely; it doesn't add cost | Process | draft |
| R-COST-002 | Options | Rib cuffs (K02), V-neck (C02) and drop tail add sewing time; prices come from the factory profile | Each adds an operation on the line | Choose them for looks, not by default | Factory price list | draft |
| R-COST-003 | Personalisation | Names and numbers cost $0.80–1.80 per piece at the factory (placeholder) and are included in Knitwright's club price | They are printed in the same pass, but each piece needs its own file and checking | Collect rosters early; late changes delay the batch | Supplier price lists, May 2026; replace with partner quote | draft |
