# Flats: questions for the owner and for a garment professional

Everything here is provisional until it is confirmed. Each line gives the question, then
what the code does today. Most answers are a number in `templates/template.ts`,
`templates/basis.ts` or `templates/collar.ts`, not a redesign.

## Approval of the drawings (owner action A6)

- Do the snapshot pictures in `docs/owner/flats/` look like the right garments? See the
  README there. Until you say yes for each type, the drawings are not approved.
- The collars were redrawn after review. The polo now has two pointed leaves that lie over the
  top of the placket, a fold line on each leaf, a collar stand behind the neck and a narrow
  neck opening (about a third of the shoulder width). The back of the polo collar is a curved
  band that follows the back neckline. The band collar is a stand that is thinner at the sides
  than at the middle, and a zip runs through it. Are these right? The polo collar leaves are still
  drawn with simple curves, and a real pattern may have a rounder or a sharper point.
- The inside of the neck opening is shown in a slightly darker tone of the body colour. Is that
  how a flat should show the inside back?
- Side panels are thinner at the underarm than at the hem, and follow the armhole and the hem.
  Is the shape right, and how wide should they be?

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

## Colours and sizes shown

- A colour picked for the screen is stored with no colour code. The code stays empty until a
  person types one, because a screen colour is not a colour reference for a factory.
- A drawing that is not to scale carries no size. The SVG has a viewBox only, and says so in
  its description. The PDF prints no size or scale either.
- The made-up review sizes now use a narrower neck for polos (15 cm) and band collars (16 cm).
  They are made up for the pictures only and are never loaded as size charts.
