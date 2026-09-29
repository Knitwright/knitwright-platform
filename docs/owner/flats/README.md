# Owner action A6: approve the drawing of each garment

The platform draws every top as a flat, front and back, the way a tech pack shows it.
Before this goes to customers, you need to say whether each drawing looks right.

## What you are looking at

Each picture has a line at the top that says **Made-up sizes for review of the drawing
only**. The sizes are invented so the drawing has a realistic shape. They are not real
measurements. Do not judge the sizes. Judge the shape.

The colours are also made up. They are only there so you can tell the parts apart. The
navy parts are the neckband, collar or cuffs. The red strips are side panels. The pale
strip down the front of a polo is the placket.

There are two files for each picture. The PNG is the easy one to open. The SVG is the
same drawing in the format the platform exports. It opens in a drawing tool with the
parts in named layers: Panels, Seams, Stitching, Details and Artwork.

## What to look at

For each garment, ask yourself:

1. **Does it look like that garment?** A garment professional should be able to tell what
   it is at a glance.
2. **Are the curves right?** Look at the armhole, the neckline and the collar. They
   should be smooth and look like a real pattern.
3. **Do the sleeves hang naturally?** Look at the angle and the width. On a raglan the
   seam should run from the underarm up to the neck.
4. **Is the back neckline shallower than the front?** It should be.
5. **Are the details in the right place?** Check the placket, the buttons or zip, the
   cuffs, the side panels, the hem and the side vents.
6. **Are the proportions right?** Are the body, the sleeve and the neck the right size
   compared with each other?

## The pictures

| Garment | Front | Back |
|---|---|---|
| Crew neck tee | `crew-tee-front.png` | `crew-tee-back.png` |
| V neck tee | `v-neck-tee-front.png` | `v-neck-tee-back.png` |
| Long sleeve tee | `long-sleeve-tee-front.png` | `long-sleeve-tee-back.png` |
| Polo shirt | `polo-front.png` | `polo-back.png` |
| Team jersey | `team-jersey-front.png` | `team-jersey-back.png` |

Three extra pictures show the harder combinations, where the drawing is most likely to
go wrong:

| Combination | Front | Back |
|---|---|---|
| Team jersey with raglan sleeves, long sleeves, band collar, zip, curved hem, side panels and rib cuffs | `team-jersey-loaded-front.png` | `team-jersey-loaded-back.png` |
| Team jersey with a V neck, raglan sleeves and a curved hem | `team-jersey-v-raglan-front.png` | `team-jersey-v-raglan-back.png` |
| Polo with a zip, long sleeves, rib cuffs and side vents | `polo-long-zip-front.png` | `polo-long-zip-back.png` |

## Bottoms (step 17)

These pictures have **no sizes at all**. Each says so in its top line. They are drawn
from the proportions of the template, so judge the shape and not the size. The navy
parts are the waistband and cuffs, the red strips are side stripes, and the small pale
diamond between the legs is the gusset.

| Garment | Front | Back |
|---|---|---|
| Shorts | `shorts-front.png` | `shorts-back.png` |
| Joggers | `joggers-front.png` | `joggers-back.png` |
| Leggings | `leggings-front.png` | `leggings-back.png` |
| Track pants | `track-pants-front.png` | `track-pants-back.png` |
| Joggers with side stripes, a gusset and zipped pockets | `joggers-loaded-front.png` | `joggers-loaded-back.png` |
| Track pants with ankle zips and side stripes | `track-pants-zip-front.png` | `track-pants-zip-back.png` |
| Cropped leggings with side stripes | `leggings-cropped-front.png` | `leggings-cropped-back.png` |

For bottoms, look especially at the hip curve, where the legs meet, how far apart the
legs hang, and the waistband shape of the leggings.

## How to answer

Reply to the person who sent you this with one line for each garment. Say **yes** if the
drawing is right. Say **no** and say what to change if it is not. For example:

- Crew neck tee: yes.
- V neck tee: no, the V is too deep.
- Polo shirt: no, the collar should have sharper points and sit flatter.

You can also mark up a picture, or send a photo of a flat you prefer. A photo of a real
tech pack drawing that you own is the best reference. Please do not send a drawing that
belongs to another company.

The polo collar is the drawing we are least sure about. Please look at it with care.

## How these pictures are made

They are made by a script, so they always match the platform. To make them again, run
this from the `apps/web` folder:

```
pnpm exec tsx scripts/render-flat-snapshots.mts
```

To draw only some families, name them, for example:

```
pnpm exec tsx scripts/render-flat-snapshots.mts bottoms
```

If a drawing changes on purpose, the tests fail until the saved pictures are updated
too. That is how an accidental change gets noticed.
