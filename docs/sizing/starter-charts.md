# Knitwright starter charts: where every number comes from

Owner decision, 2026-10-13: a new design must start with sensible measurements. The
Knitwright starter charts give one chart for every garment offered at launch
(`apps/web/lib/config/launch-garments.ts`) and every wearer it is made for: 13 garments,
39 charts. The data is in `apps/web/lib/sizing/charts/starter-*.ts`.

**These are Knitwright suggestions, not a factory's numbers.** They were put together from
published sportswear specifications, listed below, with the judgement written next to each
one. The app shows every value as "Suggested from a size chart", names the chart as the
"Knitwright starter chart", and tells the person to check the values with their factory
before they order. A brand's own imported chart replaces the starter chart for that garment
and wearer, and a value a person types always wins.

## What every chart holds

- **Garment measurements, not body measurements.** Each value is measured on the finished
  garment laid flat, as the registry's `howToMeasure` says. A width (chest, hem, waist, thigh,
  leg opening) is straight across the flat garment, so it is half of the way round.
- **Centimetres.** Sources in inches were converted at 2.54 cm to the inch and rounded to the
  nearest half centimetre for base values, and to a tenth of a centimetre for grades.
- **A base size, a size run, a grade and a tolerance.**

| Wearer | Size run | Base size |
|---|---|---|
| men | XS, S, M, L, XL, 2XL, 3XL | M |
| women | XS, S, M, L, XL, 2XL | M |
| youth | YXS, YS, YM, YL, YXL (about ages 4 to 5, 6 to 8, 10 to 12, 14 to 16, 18 to 20, as the youth sources label them) | YM |

- **One chart for every fit.** The charts are for a regular athletic fit and have no fit of
  their own, so a slim or relaxed design uses the same values. The screen says so.
- **Tolerances.** Plus or minus 1 cm on chest, hem, body length, waist, hip, rises, inseam,
  outseam and long sleeves; 1.5 cm on a stretched waist; 0.5 to 0.6 cm on shoulder, short
  sleeve, armhole, upper arm, thigh, knee, openings and neck points; 0.2 to 0.3 cm on rib,
  band, collar, placket, strap and back neck points. Grounding: the team uniform spec [S8]
  gives 1/2 to 1 inch on circumferences (so 0.6 to 1.3 cm flat) and 1/4 inch on small
  points; the Adstronaut guides [S5] give 1/4 inch on widths and 1/2 inch on lengths; the
  Textile Learner tee [S34] holds every point to 0.5 cm.

## Sources

Manufacturer spec sheets give finished garment measurements laid flat. They usually give
only chest, body length and sleeve length, so the other points come from the tech pack and
team uniform references, or are worked out with the rule stated beside each garment.

| Ref | Source | What it gives |
|---|---|---|
| S1 | Gildan 5000 tee spec sheet, https://www.blankstyle.com/files/specs/20774/SpecSheetMeasurements_5000.pdf | Men's tee chest (M 20 in), back length (M 29 in), sleeve from centre back, S to 5XL |
| S2 | Sport-Tek ST350 tee spec sheet, https://www.blankstyle.com/files/specs/6243/SpecSheetMeasurements_ST350.pdf | Men's athletic tee chest (M 21.5 in, 1.5 in a size, 2 in from 2XL), length (M 29 in) |
| S3 | Sport-Tek LST350 women's tee spec sheet, https://www.blankstyle.com/files/specs/6100/SpecSheetMeasurements_LST350.pdf | Women's tee bust (XS 18 to 2XL 24.5 in), length (M 26 in), sleeve from centre back (M 15 in) |
| S4 | Sport-Tek ST350LS long sleeve tee spec sheet, https://www.blankstyle.com/files/specs/6244/SpecSheetMeasurements_ST350LS.pdf | Men's long sleeve from centre back (about 34.75 in at M) |
| S5 | Adstronaut, T-shirt tech pack POM reference, https://www.adstronaut.net/blog/t-shirt-tech-pack | Unisex tee at M: chest 20 in, length 28.5, shoulder 17.75, sleeve 8.5, armhole 9.25, neck width 7, front neck drop 3.25 in, with per-size steps |
| S6 | Adstronaut, hoodie tech pack POM reference, https://www.adstronaut.net/blog/hoodie-tech-pack | Pullover hoodie at M: chest 23.5 in, length 28, shoulder 19.5, sleeve from centre back 33.5, armhole depth 10.25, bottom rib 2, hood height 15, pocket opening 7 in |
| S7 | Adstronaut, denim jeans tech pack grade table, https://www.adstronaut.net/blog/denim-jeans-tech-pack | Leg grading: rises 0.25 in, thigh 1 in, knee 0.5 in, leg opening 0.5 in round a size; knee 14 in below the crotch |
| S8 | SportsEngine team uniform specification (youth and adult shorts, jersey, shooter shirt, with tolerances), https://cdn1.sportngin.com/attachments/document/0033/2552/Boys_sizes.pdf | Shorts waist relaxed and extended, elastic width 1.75 in, front rise (M 13.25 in), back rise (M 15.25 in), leg opening, inseam 9.5 in, outseam (M 20.5 in); youth shorts the same; jersey and shooter shirt chest, armhole, sleeve, neck |
| S9 | Sport-Tek YST100 youth crew spec sheet, https://assets.dc-onesource.com/0/4/041dfec29bc02131fca27f6543dfd0c4.pdf | Youth tee chest 14, 15.5, 17, 18, 19.5 in; length 19 to 27 in (2 in a size); sleeve from centre back (YM 14 in) |
| S10 | Sport-Tek YST350 youth tee, retailer chart, https://merchloop.com/products/sport-tek-youth-competitor-tee | Youth tee width YM 17 in, length 23 in |
| S11 | Sport-Tek YST350LS youth long sleeve, retailer chart, https://jiffy.com/sporttek-YST350LS.html | Youth long sleeve from centre back 25.5 to 30 in (YM 27.5 in) |
| S12 | Port Authority K547 polo spec sheet, https://assets.dc-onesource.com/7/3/7350ed6ab3558ad13a455af4b0249195.pdf | Men's polo chest (M 21.5 in, 1.5 in a size, 2 in from 2XL), front length (M 30 in), sleeve from centre back (M 19.25 in) |
| S13 | Port Authority K500LS polo spec sheet, https://assets.dc-onesource.com/a/f/af2b5d458aba36ade129fc5d69e053c6.pdf | Men's polo chest and length, matching S12 |
| S14 | Port Authority Y500 youth polo spec sheet, https://assets.dc-onesource.com/1/3/13ec8a957cd18c0baf4e301fd10f9d03.pdf | Youth polo chest 15.25, 16, 17, 18, 19.5 in; front length 17.5 to 27 in; sleeve from centre back (YM 15 in) |
| S15 | Sport-Tek ST254 hooded sweatshirt spec sheet, https://assets.dc-onesource.com/e/8/e83479fe5b461611f3a3fa1853f370fd.pdf | Men's hoodie chest (M 23.5 in, 1.5 in a size, 2 in from 2XL), length (M 29 in) |
| S16 | Gildan 18500 hooded sweatshirt spec sheet, https://www.blankstyle.com/files/specs/623/SpecSheetMeasurements_18500.pdf | Men's hoodie chest (M 22 in), length (M 28 in), sleeve from centre back (M 34 in) |
| S17 | Sport-Tek YST255 youth hoodie spec sheet, https://assets.dc-onesource.com/6/0/60a72b5ad58de34a11643648d3cf6d58.pdf | Youth hoodie chest 15 to 20.5 in (YM 18), length 19 to 27 in, sleeve from centre back 23 to 34 in (YM 28.5) |
| S18 | Sport-Tek LST94 women's track jacket spec sheet, https://assets.dc-onesource.com/a/5/a56cf3d9e933fcacd28ba2fc306514ce.pdf | Women's jacket bust (M 20 in), length (M 26 in), sleeve from centre back (M 33.5 in) |
| S19 | Sport-Tek LST90 women's tricot track jacket spec sheet, https://www.blankstyle.com/files/specs/6113/SpecSheetMeasurements_LST90.pdf | Women's jacket bust (M 21 in), length (M 25 in), sleeve (M 33.5 in) |
| S20 | Sport-Tek JST90 tricot track jacket, product measurements, https://shop.garmentdecor.com/apparel/jackets-outerwear/sport-tek-tricot-track-jacket-p617127 | Men's jacket chest (M 24 in, 1.5 in a size), length (M 28 in), sleeve 33 to 40 in |
| S21 | Sport-Tek ST358 hooded pullover spec sheet, https://assets.dc-onesource.com/0/5/0542158905acaa0f5d0da8dffed4219f.pdf | Men's light hooded top chest (M 21.5 in), length (M 29 in), as a check on S15 |
| S22 | Sport-Tek ST575 short, spec sheet and measurements, https://catalog.companycasuals.com/p/18477_Black/specSheetMeasurements | Men's short waist flat (M 15 in, 1.5 in a size), inseam 9 in, 9.25 to 10 in from XL |
| S23 | Sport-Tek ST103 short spec sheet, https://assets.dc-onesource.com/1/b/1bb88bc832f018ef7cdcc27ceb8ceb5c.pdf | Men's short waist flat (M 14.75 in), inseam 7 in |
| S24 | Sport-Tek LST442 women's short spec sheet, https://assets.dc-onesource.com/5/b/5b3f80e891ca7b0c1e9f6e19c30f2225.pdf | Women's short waist flat (M 13.5 in), hips flat (M 20.5 in), inseam 5 in, steps 1, 1, 1.5, 1.5 in |
| S25 | Sport-Tek YST4420 youth short spec sheet, https://assets.dc-onesource.com/4/a/4a6d46190c38944c952caf79eebcce7e.pdf | Youth short waist flat 9.75, 11.25, 12.25, 13.75, 15.25 in |
| S26 | OGIO OG707 jogger, spec sheet and measurements, https://catalog.companycasuals.com/p/18383_Blacktop/specSheetMeasurements | Men's jogger waist flat (M 16 in, 1.5 in a size), inseam (M 27.5 in) |
| S27 | Gildan 18400 sweatpants spec sheet, https://www.blankstyle.com/files/specs/1309/SpecSheetMeasurements_18400.pdf | Men's open-bottom sweatpant waist flat (M 14 in), inseam (M 32.5 in) |
| S28 | Nike Tech Knit jogger listing, https://www.nordstrom.com/s/nike-tech-knit-jogger-pants/4424511 | Jogger at M: front rise 13 in, back rise 16.5 in, leg opening 9 in round |
| S29 | Sport-Tek ST356 tank spec sheet, https://assets.dc-onesource.com/1/8/18609692b0dc2836f3b7dc24ec6e2996.pdf | Men's tank chest (M 21 in, 1.5 in a size), length (M 29 in) |
| S30 | Port & Co LPC380TT women's performance tank spec sheet, https://assets.dc-onesource.com/0/a/0aace94603a503bb78e16b41d0aa8930.pdf | Women's tank bust 15, 16, 17, 18.75, 20.5, 22.5 in; length (M 26 in, 0.5 in a size) |
| S31 | Sport-Tek YST551 youth tank spec sheet, https://assets.dc-onesource.com/f/6/f65042f466cc3107d78c5c4a786f466f.pdf | Youth tank chest 14 to 19.5 in (YM 17), length (YM 24.75 in, 2 in a size) |
| S32 | everybody.world tank dimensions, https://everybody.world/pages/the-tank-dimensions | Women's tank strap width 1.25 to 2 in (M 1.5 in) |
| S33 | Size.ly, size grading for apparel brands, https://www.size.ly/blog/size-grading-for-apparel-brands | Knit tops grade about 1 in (2.5 cm) flat a size through the core sizes, more in extended sizes |
| S34 | Textile Learner, measurement points for basic tees and trousers, https://textilelearner.net/measurements-points-for-mens-basic-t-shirt-long-sleeve-t-shirt-and-trouser/ | Points of measure and a plus or minus 0.5 cm tolerance; back neck drop held at 1.5 cm across sizes |
| S35 | Bella+Canvas BC6008 women's racerback tank spec sheet, https://www.blankstyle.com/files/specs/13547/SpecSheetMeasurements_BC6008.pdf | Women's racerback bust (M 16.75 in), as a check on S30 |

### Rules used more than once

- **Sleeve length from the shoulder seam.** Spec sheets give sleeve length from the centre
  back neck. Knitwright measures from the shoulder seam, so: sleeve = centre back sleeve less
  half the shoulder width. The grade is the centre back grade less half the shoulder grade.
- **Hem width.** A tee, polo, jersey, singlet, vest or track jacket hangs straight, so the
  hem equals the chest and grades the same. A hoodie with a ribbed hem band pulls in: hem =
  85 percent of the chest, grading at 85 percent. A hoodie made with a plain hem should have
  its hem width typed in.
- **Circumference to flat.** Where a source gives a measurement all the way round (the team
  uniform spec [S8], the jeans table [S7]), the flat value is half of it.
- **Outseam of long trousers.** Outseam = inseam + front rise less 2 cm, as in the jeans
  table [S7], where 32 in inseam and 10.5 in rise make a 42.5 in outseam.
- **Points with no published value.** Collar height, placket length and width, hood width,
  kangaroo pocket width and height, and the back of a singlet have no value in any source
  read. Their numbers are Knitwright judgement, said so below, and are the first to check
  with a factory.

## Tops

### `crew-tee` for men
Chest 53 cm at M: between the Gildan 5000 [S1] and Adstronaut [S5] 20 in (50.8 cm) and the
ST350 [S2] 21.5 in (54.6 cm), for a regular athletic fit. Grade 4 cm a size and 5 cm into
3XL, between the 1.5 in of S2 and the 2 in of S1. Length 73 cm (29 in in S1 and S2, 28.5 in
S5), 2.5 cm a size (1 in in all three). Shoulder 45 cm (17.75 in, S5), 1.8 cm (S5's 0.69 in
average step). Sleeve 21.5 cm (8.5 in, S5; 8.5 in shooter shirt in S8), 1 cm. Armhole 23.5 cm
(9.25 in, S5), 1.3 cm (0.5 in, S5). Neck width 18 cm (7 in, S5), 0.6 cm (0.25 in, S5). Front
neck drop 8.5 cm (3.25 in, S5), 0.6 cm. Back neck drop 2 cm, held at every size (S34 holds it
at 1.5 cm; S5 gives 0.75 to 1 in). Upper arm 20 cm and sleeve opening 18 cm: derived, as no
tee source gives them flat. The shooter shirt [S8] gives a 20.5 in bicep and 15.5 in opening
round a looser body (26 and 19.7 cm flat); Knitwright takes 20 cm (85 percent of the straight
armhole) and 18 cm (90 percent of the upper arm), grading 1 cm and 0.8 cm.

### `crew-tee` for women
Bust 51 cm at M (20 in, LST350 [S3]); steps 2.5, 2.5, 3.8, 3.8, 3.8 cm (S3's 1, 1, 1.5, 1.5,
1.5 in). Length 66 cm (26 in, S3), steps 1.3, 1.3, 2.5, 2.5, 2.5 cm (S3). Sleeve 18.5 cm: S3's
15 in (38.1 cm) from centre back less half a 39 cm shoulder; grade 0.8 cm. Shoulder 39 cm,
armhole 21 cm, upper arm 17 cm, sleeve opening 15.5 cm, neck width 17 cm, front neck drop
9.5 cm: derived from the men's crew tee by the ratio of the women's to the men's bust and
length (about 0.96 and 0.9), with a women's crew neck set 1 cm deeper. Judgement.

### `crew-tee` for youth
Chest 43 cm at YM (17 in in YST100 [S9] and YST350 [S10]); steps 3.8, 3.8, 2.5, 3.8 cm
(S9's 1.5, 1.5, 1, 1.5 in). Length 58.5 cm (23 in, S9 and S10), 5.1 cm a size (2 in, S9).
Sleeve 17.5 cm: S9's 14 in from centre back less half a 36 cm shoulder, which matches the
7 in shooter shirt sleeve of S8; grade 1.3 cm (0.5 in, S8). Neck width 15 cm (6 in shoulder
to shoulder, S8 youth jersey). S8 keeps the neck the same at every youth size; Knitwright
grades it 0.5 cm, as a 4-year-old and a 16-year-old do not share a neck. Shoulder 36 cm,
armhole 18.5 cm, upper arm 15.5 cm, opening 14 cm, front neck drop 7 cm and back neck drop
1.5 cm: derived from the men's tee by the youth to men chest ratio (about 0.8). Judgement.

### `v-neck-tee` for men
As the men's crew tee, with a front neck drop of 15 cm (grade 0.6 cm). No source gives a V
depth for a tee; the long sleeve table in S34 gives an 18 cm front neck drop for a deep neck.
15 cm is Knitwright judgement for a sports V neck.

### `v-neck-tee` for women
As the women's crew tee, with a front neck drop of 14 cm. Judgement, as for men.

### `v-neck-tee` for youth
As the youth crew tee, with a front neck drop of 11 cm. Judgement, as for men.

### `long-sleeve-tee` for men
As the men's crew tee (ST350LS [S4] has the same chest and length as ST350 [S2]). Sleeve
65.5 cm: S4's 34.75 in (88.3 cm) from centre back less half the 45 cm shoulder; grade 1 cm
(S4's 0.75 in less half the shoulder grade). Sleeve opening 10.5 cm and 0.5 cm: judgement for
a hemmed or ribbed cuff; no source gives it.

### `long-sleeve-tee` for women
As the women's crew tee. Sleeve 61 cm: no women's long sleeve tee source was found; LST94
[S18] gives 33.5 in (85.1 cm) from centre back on a raglan jacket, which less half a 39 cm
shoulder is 65.6 cm; Knitwright takes 61 cm for a closer tee sleeve. Judgement. Opening 9.5 cm.

### `long-sleeve-tee` for youth
As the youth crew tee. Sleeve 52 cm: YST350LS [S11] gives 27.5 in (69.9 cm) from centre back,
less half the 36 cm shoulder; grade 1.8 cm (1 in less half the shoulder grade). Opening 8.5 cm,
judgement.

### `polo` for men
Chest 54.5 cm at M (21.5 in, K547 [S12] and K500LS [S13]); steps 3.8 cm and 5.1 cm into 3XL
(1.5 and 2 in, S12). Length 76 cm (30 in, S12 and S13), 2.5 cm. Sleeve 24 cm: S12's 19.25 in
(48.9 cm) from centre back less half a 46 cm shoulder is 25.9 cm; Knitwright takes 24 cm, as
the Port Authority figure runs to the hem of a ribbed cuff. Shoulder, armhole, upper arm and
opening: the men's tee values plus about 1 cm, for the polo's fuller cut. Collar height 7 cm,
placket length 14 cm and width 3 cm, held at every size: no published value was found; the
values are Knitwright judgement for a flat-knit collar and a three-button placket (S12 and
S13 describe three-button plackets). The chart gives a short sleeve; a long sleeve polo needs
its sleeve length typed in.

### `polo` for women
No women's polo spec sheet was read. Values are the women's crew tee with the ease the men's
polo adds over the men's tee (1.5 cm chest, 3 cm length, 2.5 cm sleeve), and a smaller
collar (6.5 cm) and placket (12 by 2.5 cm). Derived and judgement.

### `polo` for youth
Chest 43 cm at YM (17 in, Y500 [S14]), steps 1.9, 2.5, 2.5, 3.8 cm (S14's 0.75, 1, 1, 1.5 in).
Length 56 cm (22 in front length, S14), steps 5.1, 6.4, 6.4, 6.4 cm (S14). Sleeve 19 cm: S14's
15 in from centre back less half a 36.5 cm shoulder is 19.8 cm, rounded down; grade 0.8 cm.
Other points: the youth tee values, with a 6 cm collar and an 11 by 2.5 cm placket (judgement).

### `team-jersey` for men
Built on the athletic tee [S2] and the team jersey and shooter shirt of S8: chest 55 cm (a
little fuller than the tee, as S8's jersey and shooter shirt are cut loose), length 74 cm,
sleeve 22 cm, opening 18.5 cm, front neck drop 9 cm; grades as the men's tee. Band collar
3.5 cm and placket 14 by 3 cm: judgement. The chart gives a set-in short sleeve; a raglan
jersey has no shoulder width, and a long sleeve needs its sleeve typed in.

### `team-jersey` for women
The women's crew tee with the same extra ease as the men's jersey over the men's tee: bust
53 cm, length 67 cm, sleeve 19.5 cm. Band collar 3 cm, placket 12 by 2.5 cm. Derived.

### `team-jersey` for youth
Chest 45.5 cm at YM: S8's youth jersey is 36 in round (18 in, 45.7 cm flat), grading 3 in
round (3.8 cm flat). Length 59 cm (S8's 23 in centre front length), 2.5 cm (1 in, S8). Sleeve
18 cm (S8's 7 in shooter shirt), 1.3 cm. Neck width 15 cm (6 in, S8). Other points as the
youth tee; collar 3 cm and placket 11 by 2.5 cm are judgement.

## Bottoms

### `shorts` for men
Waist relaxed 37 cm at M: ST575 [S22] 15 in (38.1 cm) and ST103 [S23] 14.75 in (37.5 cm)
measured flat; grade 3.8 cm (1.5 in, S22). Waist stretched 61 cm: S8's 48 in extended, halved;
grade 2.5 cm. Waistband 4.5 cm (S8's 1.75 in elastic), held. Front rise 33.5 cm (S8's 13.25 in)
and back rise 40 cm (S8's 15.25 in, 38.7 cm, and the 16.5 in back rise of S28, 41.9 cm). Rises
grade 1.3 cm: halfway between the 0.25 in of S7 and the 1 in of S8. Leg opening 34 cm (S8's
27 in round, halved), 1.3 cm (S8). Thigh 35 cm, 1 cm wider than the leg opening for a straight
short leg; judgement. Inseam 23 cm (9 in, S22; S8 gives 9.5 in), growing 0.6 cm from XL up as
S22 does. Outseam 52 cm (20.5 in, S8). Hip 54 cm: no shorts source gives a flat hip; derived
from S7's 39 in hip on a 32 in waist (a hip 1.2 times the waist) with athletic ease, grading
2.5 cm (S7's 2 in round, halved).

### `shorts` for women
Waist relaxed 34.5 cm (13.5 in, LST442 [S24]) and hip 52 cm (20.5 in, S24), both stepping 2.5,
2.5, 3.8, 3.8, 3.8 cm (S24). Inseam 12.5 cm (5 in, S24). Waist stretched 57 cm: the men's
stretched to relaxed ratio (1.65) applied to the women's waist. Rises 28.5 and 36 cm, thigh
31 cm, leg opening 30 cm, waistband 4 cm, outseam 38 cm (inseam plus front rise less 3 cm):
derived from the men's shorts for a lower women's rise. Judgement.

### `shorts` for youth
Waist relaxed 31 cm at YM (12.25 in, YST4420 [S25]), steps 3.8, 2.5, 3.8, 3.8 cm (S25). Waist
stretched 43 cm (S8's 34 in extended youth waist, halved), 2.5 cm. Waistband 4.5 cm (1.75 in,
S8). Front rise 28.5 cm and back rise 33 cm (11.25 and 13 in, S8), 2.5 cm a size (1 in, S8).
Leg opening 26.5 cm (S8's 21 in round, halved), steps from S8. Inseam 22 cm (8.75 in, S8),
0.6 cm (0.25 in, S8). Outseam 44.5 cm (17.5 in, S8), 2.5 cm. Thigh 27.5 cm: 1 cm over the leg
opening (judgement). Hip 45 cm: the men's hip to waist ratio (1.45) on the youth waist.

### `joggers` for men
Waist relaxed 38.5 cm: between OG707 [S26] 16 in (40.6 cm) and Gildan 18400 [S27] 14 in
(35.6 cm), flat; grade 3.8 cm (1.5 in, S26). Waist stretched 58 cm: 1.5 times relaxed
(judgement; S8's shorts stretch further, at 1.8). Rises as the men's shorts; S28 gives 13 in
front and 16.5 in back on a jogger. Thigh 32 cm (S7's 24.5 in thigh, halved, with knit ease),
1.3 cm (1 in round). Knee 22 cm (S7's 17 in, halved, plus ease), 0.6 cm. Leg opening 11.5 cm
for a ribbed cuff (S28's 9 in round, halved), 0.5 cm. Inseam 70 cm (27.5 in, S26), growing
1.3 cm a size from M (0.5 in, S26). Outseam by the outseam rule.

### `joggers` for women
Waist 35 cm and hip 52 cm on the women's shorts steps (S24, with 0.5 cm more waist for a
long trouser). Rises 29.5 and 37 cm, thigh 30 cm, knee 20.5 cm, cuff 10.5 cm and inseam 70 cm
growing 0.6 cm a size: derived from the men's joggers for a women's cut. Judgement.

### `joggers` for youth
Waist, stretched waist, rises and hip as the youth shorts (S25, S8). Inseam 57 cm at YM: the
men's 70 cm inseam scaled by the youth to men's body length (58.5 to 73 cm), grading 5 cm a
size as the youth lengths do (S9, S17). Thigh 25 cm, knee 18.5 cm and cuff 9.5 cm: the men's
joggers scaled the same way. Derived.

### `track-pants` for men
As the men's joggers, with an open hem: leg opening 20 cm (S7's 16 in leg opening, halved,
with knit ease) and inseam 81 cm (Gildan 18400 [S27] gives 32.5 in, 82.6 cm, for an
open-bottom sweatpant; Knitwright takes 81 cm). Outseam by the outseam rule.

### `track-pants` for women
As the women's joggers, with an open 19 cm leg opening and a 76 cm inseam. Derived, judgement.

### `track-pants` for youth
As the youth joggers, with an open 17 cm leg opening and a 64 cm inseam. Derived, judgement.

## Outerwear

### `pullover-hoodie` for men
Chest 59.5 cm at M (23.5 in in ST254 [S15] and in S6; 22 in in Gildan 18500 [S16]); steps
3.8 cm and 5.1 cm into 3XL (S15). Length 72.5 cm (28 in in S6 and S16, 29 in in S15), 2.5 cm
(1 in in all three). Shoulder 49.5 cm (19.5 in, S6), 1.9 cm (0.75 in, S6). Sleeve 62 cm: S16's
34 in (86.4 cm) from centre back less half the shoulder is 61.6 cm; S6 gives 60.3 cm and S15
67.3 cm the same way; Knitwright takes 62 cm, near the middle, grading 1 cm. Armhole 26 cm
(10.25 in armhole depth, S6), 0.6 cm (0.25 in, S6). Hood height 38 cm (15 in, S6), 1.3 cm a
size (0.5 in, S6) up to XL and 0.6 cm above, so the 3XL hood does not outgrow a head. Pocket
opening 17.5 cm (7 in, S6), 0.6 cm (0.25 in, S6). Cuff and hem band 5 cm (S6's 2 in bottom
rib; the cuff is taken to match). Upper arm 22 cm (the tee's 20 cm plus fleece ease), cuff
opening 9.5 cm, neck width 20 cm, front neck drop 9.5 cm, back neck drop 2.5 cm: judgement.
Hood width 25 cm (about two thirds of the hood height), kangaroo pocket 30 by 20 cm:
judgement, no published value found. Hem width by the hem rule (50.5 cm).

### `pullover-hoodie` for women
No women's hoodie spec sheet was read. Bust 53.5 cm and its steps follow the women's tricot
jacket LST90 [S19] (21 in at M, then 1, 1, 1.25, 1.5, 1.5 in). Length 66 cm (26 in, LST94
[S18]), 1.3 cm (0.5 in, S18). Sleeve 60 cm: by the sleeve rule S18 gives about the men's
value, as its centre back sleeve is shorter by about as much as its shoulder is narrower;
Knitwright takes 2 cm less than the men's for a women's arm. Hood 36 by 24 cm, pocket 27 by
18.5 cm, opening 15.5 cm: the men's values scaled to the women's chest. Derived, judgement.

### `pullover-hoodie` for youth
Chest 45.5 cm at YM (18 in, YST255 [S17]), steps 3.8, 3.8, 2.5, 3.8 cm (S17). Length 58.5 cm
(23 in, S17), 5.1 cm (2 in, S17). Sleeve 53.5 cm: S17's 28.5 in (72.4 cm) from centre back less
half a 38 cm shoulder; steps 6.8, 5.6, 5.6, 6.8 cm (S17's 3, 2.5, 2.5, 3 in less half the
shoulder grade). Other points: the men's hoodie scaled by the youth to men chest ratio
(about 0.76). Derived.

### `zip-hoodie` for men
As the men's pullover hoodie. Zip length 58 cm: body length less the front neck drop and the
hem band (72.5 less 9.5 less 5), grading with the body length. Pocket opening as the pullover.

### `zip-hoodie` for women
As the women's pullover hoodie, with a 52 cm zip by the same rule.

### `zip-hoodie` for youth
As the youth pullover hoodie, with a 46 cm zip by the same rule.

### `track-jacket` for men
Chest 61 cm at M (24 in, JST90 [S20]), 3.8 cm (1.5 in, S20). Length 71 cm (28 in, S20),
2.5 cm (1 in, S20). Sleeve 64 cm: S20's sleeve less half a 48 cm shoulder, rounded; 1 cm.
Stand collar 6 cm, front neck drop 6 cm, zip 64 cm (body length less the front neck drop,
less 1 cm at the hem): judgement and the zip rule. Cuff and hem band 5 cm and pocket opening
17 cm as the hoodie.

### `track-jacket` for women
Bust 51 cm at M (20 in, LST94 [S18]), steps 2.5, 2.5, 3.8, 3.8, 3.8 cm (S18). Length 66 cm
(26 in, S18), 1.3 cm (0.5 in, S18). Sleeve 61 cm: S18's 33.5 in less half a 40 cm shoulder is
65 cm on a raglan measured from the neck; Knitwright takes 61 cm for a set-in sleeve. Collar
5.5 cm, zip 60 cm: judgement and the zip rule.

### `track-jacket` for youth
The youth hoodie with a jacket's cut: chest 47 cm, length 57 cm (the men's jacket is 1.5 cm
shorter than the men's hoodie), zip 52 cm by the zip rule, collar 5 cm. Derived.

## Close-fitting

### `singlet` for men
Chest 53.5 cm at M (21 in, ST356 [S29]), 3.8 cm (1.5 in, S29) and 5.1 cm into 3XL. Length
73.5 cm (29 in, S29), 2.5 cm (1 in, S29). Hem as the chest. Armhole depth 27 cm: S8's adult
jersey gives a 23 in armhole round at M; half of it, less the curve, is about 27 cm; grade
1.3 cm. Strap 4.5 cm: the women's 3.8 cm of S32 plus a little for a man's shoulder. Back at its
narrowest 24 cm for a racing back. Neck width 20 cm, front neck drop 11 cm, back neck drop
3 cm: judgement, as no tank source gives them.

### `singlet` for women
Bust 43 cm at M (17 in, LPC380TT [S30]; BC6008 [S35] gives 16.75 in), steps 2.5, 2.5, 4.4,
4.4, 5.1 cm (S30). Length 66 cm (26 in, S30), 1.3 cm (0.5 in, S30). Hem 46 cm, 3 cm wider than
the bust for a women's tank that flares a little: judgement. Strap 3.8 cm (1.5 in, S32).
Armhole depth 21 cm, back 19 cm, neck 19 cm, front neck drop 11.5 cm: judgement.

### `singlet` for youth
Chest 43 cm at YM (17 in, YST551 [S31]), steps 3.8, 3.8, 2.5, 3.8 cm (S31). Length 63 cm
(24.75 in, S31), 5.1 cm (2 in, S31). Strap 3.5 cm, armhole depth 21 cm, back 20 cm, neck
16.5 cm: scaled from the men's singlet. Derived.

### `vest` for men
As the men's singlet, with a straight back: back at its narrowest 30 cm, strap 6 cm, armhole
depth 26 cm and front neck drop 10 cm. Judgement.

### `vest` for women
As the women's singlet with a straight back: back 25 cm, strap 5 cm, armhole depth 20.5 cm,
front neck drop 10.5 cm. Judgement.

### `vest` for youth
As the youth singlet with a straight back: back 24 cm, strap 4.5 cm, armhole depth 20.5 cm,
front neck drop 8.5 cm. Judgement.

## Gaps

- Leggings, the sports bra and the compression top are not offered at launch and have no
  starter chart yet. A design in one of them still says there is no chart and asks for each
  value. The sports bra needs its own size run (see `apps/web/lib/sizing/OWNER-QUESTIONS.md`).
- A polo or team jersey with long sleeves, and a hoodie with a plain hem, get the short
  sleeve and ribbed hem values; their sleeve length or hem width should be typed in.
- No women's polo, women's hoodie or youth track jacket spec sheet was read; those charts
  are derived as said above.
- Collar, placket, hood width, kangaroo pocket and singlet back values are judgement only.
- The owner's own charts (owner action A5, `docs/owner/size-charts.md`) replace these once
  they arrive.

## Australian size labels (production outputs, W2)

Added 2026-10-15 for `plans/production-outputs.md`. **No new measurement was written.** The
Australian labels reuse the starter charts above, and the code is in
`apps/web/lib/sizing/australia.ts`. Every value shown for them is "Suggested from a size chart".

| Cut | Labels | Values come from |
|---|---|---|
| Men's | XS, S, M, L, XL, 2XL, 3XL | The men's starter chart at the same label. |
| Women's | XS, S, M, L, XL, 2XL, 3XL | The women's starter chart at the same label, XS to 2XL. **3XL has no values.** |
| Junior | 6, 8, 10, 12, 14, 16 | The youth starter chart at the nearest column by age: 6 and 8 take YS (about ages 6 to 8), 10 and 12 take YM (10 to 12), 14 and 16 take YL (14 to 16). |

- **Women's 3XL is left unset.** The women's sources read (S3 and S30) stop at 2XL, and S33 says
  only that extended sizes grade by more. A 3XL value would be a guess, so none is suggested. The
  screen says "No published source gives a women's 3XL for this garment" and asks for typed values
  or the brand's own chart.
- **Junior labels are a proposal.** Australian clubs label juniors by age (6 to 16). Mapping each to
  the nearest youth column is Knitwright's reading; two labels share each column. The owner is to
  say whether a club's 8 is really cut like a YS (owner input P3).
- **Men's and women's cuts of one product** are two starter charts under one garment type, joined by
  `cutsOfProduct(typeId)`; a junior cut is a third.
- **The pattern size each label is cut from** is a separate, suggested map (`DEFAULT_SIZE_LABEL_MAPS`).
  Men's labels map to EU 44, 46, 48, 50, 52, 54, 56 for XS to 3XL: the benchmark pattern is EU 48
  and the plan names "AU M men's to pattern 48"; the steps of two are the usual EU men's letter
  sizing and are not from a source read here. Women's and junior labels carry their own label as the
  pattern size ("women M", "junior 10"), because no women's or junior pattern exists yet. All are
  shown as "Suggested by Knitwright", the readiness list names them, and a brand's own choice
  replaces them (table `size_label_maps`).
