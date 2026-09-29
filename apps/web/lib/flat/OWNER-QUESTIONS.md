# Flats: questions for the owner and for a garment professional

Everything here is provisional until it is confirmed. Each line gives the question, then
what the code does today. Most answers are a number in `templates/template.ts`,
`templates/basis.ts` or `templates/collar.ts`, not a redesign.

## Approval of the drawings (owner action A6)

- Do the snapshot pictures in `docs/owner/flats/` look like the right garments? See the
  README there. Until you say yes for each type, the drawings are not approved.
- The polo collar is the weakest drawing. Today the two leaves are a simple curved
  shape joined by a stand at the back. Should they be sharper and lie flatter?

## Proportions used when measurements are missing

A new design has no measurements, so the drawing takes its shape from ratios of the chest
width. They are the designer's starting point and not measurements of any garment.

- Body length is 1.35 times the chest width. Is that right for a regular tee? Polo uses
  1.30, long sleeve tee 1.38 and team jersey 1.42.
- The shoulder is 0.88 of the chest, a short sleeve is 0.42 and a long sleeve is 1.15
  (raglan 0.55 and 1.28). Are these natural?
- The neck opening is 0.35 of the chest wide. A round neck drops 0.165 at the front and
  0.04 at the back. A V neck drops 0.30. Are these right?
- The collar is 0.11 of the chest high. The placket is 0.23 long and 0.06 wide.

## Parts that have no point of measure

These sizes are fixed shares of the chest width. Nobody can enter them yet.

- Neckband width: 0.04. Rib cuff depth: 0.10. Side panel width: 0.10.
- Shoulder slope: the shoulder point sits 0.07 of the chest below the neck point.
- Armhole curve depth: 0.055 at the front, 0.035 at the back. Raglan seam bow: 0.03.
- Curved hem: the sides rise 0.05 of the body length at the front and 0.025 at the back.
- Side vent: 0.10 of the body length high.
- Should the platform add points of measure for cuff depth, neckband width and
  side panel width, so a factory can check them?

## Choices made in the drawing

- Where the sleeve hangs is worked out from the upper arm measurement. A bigger upper
  arm makes the sleeve hang flatter. Is that how you want it?
- Measurements that are present but cannot be drawn together (for example a neck wider
  than the shoulders) are ignored and the drawing falls back to proportions. It says
  "Not to scale. Some measurements do not fit together."
- Artwork is not clipped to its panel, because the PDF library cannot clip a picture and
  the two outputs must match. Is that acceptable? Artwork on a sleeve shows on the front
  view only.
- Wearer (men, women, youth) does not change the shape yet. Do women's, youth and men's
  flats differ enough to need their own proportions?
- Fit (slim, regular, relaxed) is not drawn. The measurements carry it.
