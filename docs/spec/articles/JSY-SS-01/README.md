# JSY-SS-01 · short-sleeve sublimated jersey (worked example)

Status: **v0.1 draft for factory review**. Every value is Knitwright's starting draft. The factory's proven block replaces anything that differs. The process is in `../ONBOARDING.md`.

| File | What it is | How to use it |
|---|---|---|
| `article.json` | The whole base article as data: sizes, measurements with grades and tolerances, options, parameters, construction, BOM, print rules, placements, labels, QC | Edit this first; everything else is generated or updated from it |
| `rulebook.md` | 45 rules, each with a "why" and a best practice, in groups: pattern, fit, construction, sublimation, personalisation, labels, QC, cost | Walk through it with the factory; they confirm or correct each row |
| `pattern/JSY-SS-01_<size>.svg` | 1:1 pattern pieces (front, back, sleeve, neck rib) for each size: cut line with seam allowance, sew line, notches, grain line, labels | Open in CorelDRAW, Illustrator or Inkscape. To print, set scale to 100% and check that the bar on the sheet measures 100 mm |
| `pattern/JSY-SS-01_<size>.dxf` | The same pieces as R12 DXF in mm. Layers: 1 cut, 14 sew, 4 notches, 7 grain, 15 text | For factories with CAD or plotters. It is a review file; production DXF-AAMA comes from the platform's files service |
| `pattern/JSY-SS-01_nest.svg` | All 7 sizes stacked, to check the grading by eye | Each size a different colour; M is bold |
| `pattern/pattern-report.md` | Proof that the pattern matches the measurement table, plus armhole/sleeve-cap and neck/rib lengths | Every row must say OK; sleeve-cap ease must be 0–6 mm |
| `techpack/JSY-SS-01_techpack.html` | 17-page tech pack with factory sign-off on page 17 | See "Make the PDF" below |
| `tools/draft-pattern.ps1` | Regenerates the pattern files and report from `article.json` | `powershell -ExecutionPolicy Bypass -File tools/draft-pattern.ps1` |

## Make the PDF

1. Open `techpack/JSY-SS-01_techpack.html` in Chrome or Edge. Keep the folder structure, because page 9 loads the pattern image from `../pattern/`.
2. Press Ctrl+P.
3. Set Destination to "Save as PDF", Layout to "Landscape", Paper to "A4", Margins to "None", and tick "Background graphics".
4. Save.

## What the drafted pattern is, and isn't

- It is a geometrically consistent starting block. All measurements in `article.json` are built in exactly, the sleeve cap is solved to match the armhole with 3 mm ease, the seam allowances are correct per seam, and notches are placed.
- It has not been sewn yet. Shoulder slope, armhole shape and neck curve are standard draft shapes, not your factory's tested curves. That is what step 5 (factory overlay) and step 6 (samples) are for.
- Only the default options are drafted (crew neck C01, hem K01, no parameter offsets). The V-neck, rib cuff and drop tail are drafted once the base is approved.
