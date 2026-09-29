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

## Bottoms (added in step 17)

The drawing of shorts, joggers, leggings and track pants. All ratios are against the hip
width, and are a starting point written without a garment professional. They are in
`families/bottoms/proportions.ts` and `families/bottoms/shape.ts`.

- Full length: waist relaxed 0.74, waist stretched 1.06, waistband 0.075 (wide band 0.15),
  front rise 0.56, back rise 0.70, thigh 0.55, knee 0.40, leg opening 0.30 (0.24 with
  ribbed cuffs), inside leg 1.50, outside leg 2.02.
- Shorts: inside leg 0.30, leg opening 0.50, thigh 0.58. Cropped: inside leg 1.12.
- Leggings: front rise 0.50, back rise 0.64, thigh 0.50, knee 0.33, leg opening 0.20.
- The front of the leg at the crotch is drawn at 0.92 of the thigh, because the flat thigh
  measure takes in the back of the leg too. Is that how your flats show it?
- The crotch sits at 0.93 of the front rise, because the rise is measured along its curve.
- The knee is drawn halfway down the inside leg, as the how-to-measure sentence says.
- The legs hang a little apart at the hem (0.025 of the hip between them) so the inside
  seams can be seen. Real flats differ on this. Is it right?
- Parts with no point of measure: cuff depth 0.10, side stripe width 0.045, gusset 0.07.
  Should cuff depth and stripe width be points of measure?
- The gusset is shown from the front as a small diamond where the legs meet.
- The drawcord hangs from two eyelets at the centre front of the waistband.
- Side seam pockets are drawn as a slanted opening line just inside the side seam. Is a
  slant pocket what your customers mean?
- The back view has no back pocket and no yoke. Should it offer them?

## Outerwear (added in step 20)

The body, sleeves, neck and stand collar of a hoodie or track jacket are drawn by the tops
code, from the tops ratios with long sleeves. What outerwear adds is in
`families/outerwear/`. All ratios are against the chest width.

- Changed from a top: body length 1.20, shoulder width 0.90, neck width 0.36, front neck
  drop 0.15.
- Hood height 0.62 and hood width 0.46. From the front the hood is drawn 0.62 of the hood
  width wide on each side of the centre, and the face opening 0.62 of that. The hood is
  always drawn up, as worn. Should the back view show it lying down instead?
- The face opening of a pullover hood closes in a point at the front neck. Real hoods often
  cross over there. Is a point acceptable?
- Kangaroo pocket 0.62 wide and 0.36 high, sitting on the hem band, with its top 0.62 of its
  bottom width and curved open sides.
- Side pockets: an opening 0.30 long, slanting a little, just inside the side seam.
- Cuff and hem band 0.12. Stand collar 0.13.
- The zip runs from the hem to the neck seam, or to the top of a stand collar. Its length
  is worked out from the other ratios.
- With a hood, the neck seam is where the hood is sewn. With no hood and no collar, the
  neck is finished with a neckband, drawn as on a tee.
