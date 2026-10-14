# Owner action A5: size charts for every garment family

Since 2026-10-13 every garment offered at launch starts from a **Knitwright starter chart**:
published, industry-typical garment measurements, shown as suggestions to check with the
factory. `docs/sizing/starter-charts.md` lists every chart and its sources. Your own numbers,
sent as below, replace a starter chart for the same garment and wearer, and a brand's own
imported chart replaces both. This page says exactly what to send.

These are **garment measurements**: what a factory checks on a finished garment laid
flat. They are not body measurements.

## What to send

One sheet for each wearer and garment type. Fill in `size-chart-template.csv`, or send
your own sheets in any layout and say which column is which.

| Column | Meaning | Example |
|---|---|---|
| `wearer` | `men`, `women` or `youth` | `men` |
| `garment_type` | Tops: `crew-tee`, `v-neck-tee`, `long-sleeve-tee`, `polo`, `team-jersey`. Bottoms: `shorts`, `joggers`, `leggings`, `track-pants`. Outerwear: `pullover-hoodie`, `zip-hoodie`, `track-jacket`. Close fitting: `singlet`, `vest`, `sports-bra`, `compression-top`. | `crew-tee` |
| `fit` | Leave empty if you have one fit. Otherwise `slim`, `regular` or `relaxed`. | `regular` |
| `point_of_measure` | One of the names in the list below | `chest-width` |
| `base_size` | The size you grade from | `M` |
| `base_value_cm` | The measurement at the base size, in centimetres | `52.5` |
| `grade_cm` | How much it grows from one size to the next, in centimetres. If it is not the same between every pair of sizes, give each step, smallest first, separated by `/`. | `2.5` or `2/2.5/2.5/3` |
| `tolerance_cm` | How far a finished garment may be off, plus or minus | `1` |
| `source` | Who produced the number and when | `Sameed Ilyas, 2026-10-02` |

Also send, once for each wearer:

| Item | Example |
|---|---|
| The size run, smallest first | `XS, S, M, L, XL, 2XL, 3XL` |
| For youth, what the sizes are called | `6Y, 8Y, 10Y, 12Y, 14Y` |
| For sports bras, their own size run for women and for youth | `XS, S, M, L, XL` or `32A, 32B, 34A` |

Sports bras are sized in their own size system, declared in the garment registry, so
their charts use the sports bra size run and never the usual women's or youth run.

## Points of measure for tops

| Name | Needed for |
|---|---|
| `chest-width` | Every top |
| `body-length` | Every top |
| `shoulder-width` | Tops with a set-in sleeve. A raglan sleeve has no shoulder seam to measure to. |
| `sleeve-length` | Every top |
| `armhole` | Every top |
| `upper-arm` | Every top |
| `sleeve-opening` | Every top |
| `hem-width` | Every top |
| `neck-width` | Every top |
| `front-neck-drop` | Every top |
| `back-neck-drop` | Every top |
| `collar-height` | Tops with a collar |
| `placket-length` | Tops with a placket |
| `placket-width` | Tops with a placket |

## Points of measure for bottoms

Shorts, joggers, leggings and track pants. Leggings have no fit choice, so leave `fit`
empty for them.

| Name | Needed for |
|---|---|
| `waist-relaxed` | Every pair, measured without stretching |
| `waist-stretched` | Every pair, measured stretched as far as it goes |
| `waistband-height` | Every pair |
| `hip` | Every pair |
| `front-rise` | Every pair |
| `back-rise` | Every pair |
| `thigh` | Every pair |
| `knee` | Cropped and full length legs. Shorts end above the knee. |
| `leg-opening` | Every pair |
| `inseam` | Every pair (inside leg) |
| `outseam` | Every pair (outside leg, from the top of the waistband) |

## Points of measure for outerwear

Pullover hoodie, zip hoodie and track jacket. The body, sleeve and neck points are the
same as for tops and are measured the same way: `chest-width`, `body-length`,
`shoulder-width` (set-in sleeves only), `sleeve-length`, `armhole`, `upper-arm`,
`sleeve-opening`, `hem-width`, `neck-width`, `front-neck-drop`, `back-neck-drop`. Then:

| Name | Needed for |
|---|---|
| `hood-height` | Hoodies |
| `hood-width` | Hoodies |
| `zip-length` | Zip hoodie and track jacket |
| `pocket-opening` | Any garment with pockets |
| `pocket-width` | Kangaroo pocket only |
| `pocket-height` | Kangaroo pocket only |
| `cuff-height` | Ribbed cuffs |
| `hem-band-height` | Ribbed hem band |
| `collar-height` | Track jacket with a stand collar |

## Points of measure for close-fitting garments

Singlet, vest, sports bra and compression top. Sports bras and compression tops have no
fit choice, so leave `fit` empty for them. Sports bras are made for women and youth only.

| Name | Needed for |
|---|---|
| `chest-width`, `body-length`, `neck-width`, `front-neck-drop`, `back-neck-drop` | Every garment, measured as for tops |
| `hem-width` | Singlet, vest and compression top |
| `underbust` | Sports bra (across the underband, not stretched) |
| `armhole-depth` | Garments with no sleeves |
| `strap-width` | Garments with no sleeves |
| `back-width-narrowest` | Garments with no sleeves |
| `shoulder-width`, `sleeve-length`, `armhole`, `upper-arm`, `sleeve-opening` | Compression top, measured as for tops |

## What happens to the numbers

- They are loaded as the default charts. Every value is shown as **suggested**, never as
  checked, and the chart names you as its source with the date.
- A brand can change any value. A changed value is shown as the brand's own.
- Nothing is shown as checked until a named person signs a spec. That screen is planned
  for after launch.

## If you do not have all of it

Send what you have. A chart for one wearer and one garment type is enough to finish the
measurement table for that pair and to test everything else. The other pairs stay empty,
and the editor says so, until their numbers arrive.

## Australian labels and pattern sizes (owner input P3)

Knitwright now shows Australian size labels (men XS to 3XL, women XS to 3XL, junior 6 to 16) and
a pattern size for each. Everything is a suggestion until you say otherwise. Please tell us:

1. **Women's 3XL.** The sources we read stop at 2XL, so there are no starter measurements for it.
   Send women's 3XL measurements for each garment, or your own chart.
2. **Junior labels.** Is a club's 8 cut like our YS (ages 6 to 8), a 12 like YM, a 16 like YL? Send
   the measurements you use if not.
3. **Which pattern size each label is cut from.** We suggest men's XS to 3XL from EU 44 to 56, with
   M as the benchmark's EU 48. Change any of them under Brands, Fabrics and sizes.
