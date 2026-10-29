# 04 · Knitwright Production Package (KPP)

The KPP is the set of files that lets a factory make a design version without asking questions. It is the core asset of the platform. Every file is generated server-side from one `design_version` and one factory profile. Nothing is hand-edited. Regenerating from the same version hash gives byte-identical files, except for timestamps in PDF metadata, which are pinned to the version's creation time.

## Package layout

One ZIP per design version × factory (for export or sample) or per batch (for production):

```
KPP_<designCode>_v<version>_<factoryCode>/
├── manifest.json                      # every file, sha256, generator version, design hash
├── 00_README.pdf                      # one page: what is inside, who to contact, due date
├── 01_techpack/
│   ├── techpack.pdf                   # human-readable, A4 landscape
│   └── techpack.json                  # same content, machine-readable
├── 02_measurements/
│   ├── pom.csv                        # points of measure per size with tolerances
│   └── size_chart_customer.pdf        # garment measurements for buyers
├── 03_patterns/
│   ├── dxf_aama/<article>_<size>.dxf  # DXF-AAMA (ASTM D6673) per size, net + seam allowance
│   ├── dxf_aama/<article>_nest.dxf    # all sizes nested on one file (graded nest)
│   ├── pdf_1to1/<article>_<size>.pdf  # 1:1 scale panel outlines with notches/grain, A0 tiles
│   └── svg/<article>_<size>.svg       # vector outlines in mm; opens in CorelDRAW and Illustrator
├── 04_print/
│   └── <size>/<article>_<panel>_<size>.pdf   # per-panel print file (or .tif, factory profile decides)
├── 05_colour/
│   ├── colour_spec.pdf                # colour roles, hex, Lab, Pantone TCX, ΔE tolerance, swatch IDs
│   └── colour_spec.json
├── 06_bom/
│   └── bom.csv                        # fabric, thread, labels, trims, packaging with quantities per size
├── 07_labels/
│   ├── care_label_<market>.pdf        # fibre content, care symbols, origin, size; per destination market
│   └── brand_label.pdf                # if the brand provided one
├── 08_personalisation/                # production packages only
│   └── names_numbers.csv              # order, line, size, name, number, panel zone
├── 09_qc/
│   └── qc_checklist.pdf               # POM tolerances, AQL plan, colour checks, photo list
└── 10_reference/
    ├── renders_front_back.pdf         # deterministic 3D renders, labelled "render, not photo"
    └── golden_sample.pdf              # photos and measurements of the approved sample (if any)
```

Batch packages add `job_sheet.pdf` (order list, size breakdown per article, due date, packing instructions) at the root and group print files by order: `04_print/<orderNo>/<size>/...`.

## File specifications

### Tech pack PDF (`techpack.pdf`)

A4 landscape. The page order follows the SpecForm demo pack (14 pages), which is close to what factories expect. Knitwright adds personalisation and QC pages. Every page has:
- a header block: brand, style name, style #, season, base size, version;
- a footer: style # and "Page x of y".

| # | Page | Content |
|---|---|---|
| 1 | Overview | Style details table (brand, style name, style #, season, base size, category, silhouette, fit, size range, factory, class, revision) and "Key construction features" in plain sentences, generated from the construction table, e.g. "Side seam: 4-needle flatlock 607, flat finish against skin" |
| 2 | Technical flats · black & white | Front/back vector flats generated from panel geometry + options |
| 3 | Rendered views · colour | Front/back/side renders from the 3D model, labelled "render, not photo" |
| 4–5 | Bill of materials | Columns: Item # · Category · Description · Fibre/material · Weight/GSM · Colour/Pantone · Supplier code · Consumption per piece · Notes. Continues onto page 5 when long (fabric, thread, trims first; labels, hangtag, polybag after) |
| 6 | Construction details | Table: detail type · construction detail (seam type, stitch class, SPI/stitches per cm, thread, seam allowance, hem and binding widths) |
| 7 | Construction annotations | Flat with numbered callouts 1…n and a legend table |
| 8 | Measurement annotation | Flat with lettered POM lines A…n and the base-size table (POM · value · unit) |
| 9 | Size grading | POM × sizes, with base size marked, grade rule and tolerance per POM (see `pom.csv`) |
| 10 | Graphics & prints | Every artwork asset with file name, type (sublimation, heat transfer, embroidery) and colours |
| 11 | Print placement | Each panel at the base size with artwork boxes dimensioned in mm from anchors; table: graphic · type · W × H mm · position · `scale_by_size` rule |
| 12 | Personalisation | Font, heights per zone, colour, outline; example name/number; rules (max chars) |
| 13 | Labels & packaging | Care, size and brand label artwork and positions; fold, polybag and carton spec |
| 14 | Colourways | One block per colourway: fabric, colour roles with Pantone TCX and hex, swatch ID, ΔE tolerance (default ΔE CMC 2:1 ≤ 1.5) |
| 15 | QC checklist | AQL plan, POM to check, colour check, photo list |
| 16 | Reference images | Golden-sample photos (when approved) and fabric/trim swatch photos per BOM item |

Every field carries provenance (`from_base`, `from_design`, `needs_input`, `confirmed`) and a `rule_id`. Fields still `needs_input` and any `[TBC]` value block export (F-G2), so a package never contains unconfirmed values. The JSON version (`techpack.json`) has the same sections and includes provenance and rule IDs, so a factory or PLM can import it.

### `pom.csv`

```csv
article,pom_letter,pom_code,description,grade_type,grade_mm,tol_minus_mm,tol_plus_mm,base_size,XS,S,M,L,XL,2XL,3XL
JSY-SS-01,A,CH,Chest width 2.5cm below armhole,linear,40,10,10,M,440,480,520,560,600,640,680
JSY-SS-01,B,BL,Body length HPS to hem,linear,20,10,10,M,680,700,720,740,760,780,800
JSY-SS-01,C,SL,Sleeve length shoulder to cuff,linear,5,5,5,M,205,210,215,220,225,230,235
SHO-TR-01,A,WR,Waist relaxed,linear,40,10,10,M,300,340,380,420,460,500,540
SHO-TR-01,B,IN,Inseam,fixed,0,5,5,M,127,127,127,127,127,127,127
```

The measurement values above are illustrative only; real values come from the factory's pattern master in Phase 0. Default tolerances: ±10 mm on body widths and lengths, ±5 mm on sleeve, inseam, neck and waistband heights, ±3 mm on compression articles. These are placeholders to confirm with the factory in Phase 0.

### DXF-AAMA (`03_patterns/dxf_aama`)
- ASTM D6673 / AAMA DXF written with `ezdxf` (its AAMA/ASTM add-on).
- One block per piece with:
  - cut line (layer 1);
  - sew line (layer 14);
  - grain line (layer 7);
  - notches as V-notch or slit per factory profile (layer 4);
  - drill holes (layer 13);
  - piece name, size and quantity text;
  - units in mm.
- One file per size, plus a nest file with all sizes stacked. A separate grading rule file (`.rul`) is out of scope until a factory requests it; the nest serves as the graded set.

**Test matrix (must pass in Phase 0):**
- Opens without errors in Seamly2D, Valentina, Inkscape (as DXF) and at least one commercial CAD the partner factory uses (Gerber AccuMark, Optitex, Richpeace or Tukatech).
- Piece outlines are closed.
- Measured seam lengths match `panel_geometry` within 0.5 mm.

### 1:1 PDF and SVG (`pdf_1to1`, `svg`)
These are the factory-native formats in Sialkot, where pattern and sublimation teams work in CorelDRAW. Both are exact 1:1 vector outlines in mm. The PDF is tiled for A0 plotting with alignment marks. The SVG is a single canvas. CorelDRAW opens both. Native `.cdr` is not generated (there is no reliable open writer); the Phase 0 test confirms whether PDF or SVG is enough.

### Print files (`04_print`)
- One file per panel per size. Default PDF/X-4 with an embedded raster at **150 DPI at 1:1** (vectors kept as vectors). TIFF or 300 DPI on request in the factory profile.
- **Bleed:** 10 mm beyond the cut line (factory profile can override). Registration marks and panel label (order, article, panel, size) are placed outside the bleed.
- **Colour:** sRGB working space. Converted at export with the factory's measured ICC profile for that fabric and paper when one exists; otherwise left as sRGB and flagged in the README.
- **Not mirrored.** The factory's RIP mirrors for transfer paper; the README states this.
- Artwork for each size is re-rendered from the design object using `scale_by_size`, never by scaling the size-M image.
- **Size:** a 3XL back panel at 150 DPI is about 4,200 × 5,300 px, which is fine server-side. Never render print files in the browser.
- **Naming:** `<orderNo|SAMPLE>_<article>_<panel>_<size>.pdf`, for example `KW10422_JSY-SS-01_back_XL.pdf`.

### `colour_spec.json`

```json
{
  "design_version": "...", "fabric": "F-POLY-INT", "tolerance": { "metric": "dE_CMC_2_1", "max": 1.5 },
  "colours": [
    { "role": "primary", "hex": "#0B1F4B", "lab": [12.9, 4.1, -27.6], "pantone_tcx": "19-4024 TCX", "swatch_id": "SB-POLY-INT-031" }
  ],
  "strike_off_required": true
}
```

### `bom.csv`

```csv
item,type,spec,supplier_ref,qty_per_piece,unit,size_dependent
Main fabric,fabric,F-POLY-INT 150gsm white sublimation,,1.10,m,true
Thread,thread,Poly core-spun Tex 27 white,,180,m,false
Neck tape,trim,10mm poly tape,,0.45,m,true
Care label,label,Printed satin 30x60mm,,1,pc,false
Polybag,packaging,Recycled LDPE 30x40cm with suffocation warning,,1,pc,false
```

### `names_numbers.csv`

```csv
order_no,line_id,size,name,number,name_zone,number_zone,font_id,colour_hex
KW10422,L1,M,SMITH,7,back_name,back_number,kw-block-01,#FFFFFF
```

### Labels (`07_labels`)
Generated per destination market from `country_rule.label_rules`:
- fibre composition in the required language and order;
- care symbols (ISO 3758);
- country of origin ("Made in Pakistan");
- size;
- importer or brand name and address where required.

### QC checklist (`qc_checklist.pdf`)
- POM points to measure with tolerances.
- Sample size from AQL tables (level II, AQL 0 critical / 2.5 major / 4.0 minor) for runs; 100% for Class A.
- Colour check against swatch with ΔE.
- Artwork placement check against the placement page.
- Names and numbers against the CSV.
- Required photos: front, back, label, close-up of seams and print edge.

## Generation pipeline (files service)

```
design_version (doc JSON) + factory_profile
   │
   ├─▶ validate()  ── fails ─▶ stop, return checks
   │
   ├─▶ geometry:   parametric_script(article, params, size) → panels (mm) for every size
   ├─▶ patterns:   panels → DXF-AAMA (ezdxf) · 1:1 PDF (reportlab/pikepdf) · SVG
   ├─▶ print:      panels + layers → per-panel per-size raster/vector (skia-python or node skia-canvas) → PDF/X-4
   ├─▶ colour:     roles → Lab/Pantone, ICC transform if profile exists
   ├─▶ techpack:   HTML template → WeasyPrint → PDF; same data → JSON
   ├─▶ labels, bom, pom, qc, personalisation CSV
   └─▶ manifest.json (sha256 of each) → ZIP → R2 → package_export row
```

Jobs run on the files service (FastAPI on Modal). A full 8-size package for one article should build in under 60 seconds. Batch packages are built at cut-off and cached by `(version_hash, factory_id, size)`.

## What the Phase 0 factory test must prove

1. The factory produces a sample from the KPP alone, with no calls or WhatsApp questions, recorded in the job packet.
2. Measured POMs are within tolerance on 3 sizes.
3. Colour is within ΔE CMC 2:1 ≤ 1.5 against the strike-off on all colour roles (or the tolerance the factory can actually hold is recorded).
4. Which of DXF-AAMA, 1:1 PDF and SVG the factory actually used, and what it changed.
5. The quoted price for MOQ 1 in a weekly slot and for 50/100/300 pieces.
