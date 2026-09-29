# Owner action A5: size charts for every garment family

The platform needs your numbers before it can show a measurement table. It will not make
them up. This page says exactly what to send.

These are **garment measurements**: what a factory checks on a finished garment laid
flat. They are not body measurements.

## What to send

One sheet for each wearer and garment type. Fill in `size-chart-template.csv`, or send
your own sheets in any layout and say which column is which.

| Column | Meaning | Example |
|---|---|---|
| `wearer` | `men`, `women` or `youth` | `men` |
| `garment_type` | Tops: `crew-tee`, `v-neck-tee`, `long-sleeve-tee`, `polo`, `team-jersey`. Bottoms: `shorts`, `joggers`, `leggings`, `track-pants`. Outerwear: `pullover-hoodie`, `zip-hoodie`, `track-jacket`. | `crew-tee` |
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
