# Owner action A10: judge the 3D trial

The plan (step 9A) says: build a 3D form from the flat for the crew tee, show it to you,
and continue only if you accept it. These pictures are that trial. Nothing after it is
built until you give a verdict.

## What you are looking at

The form is made from the flat itself. The outline of the front and the back is split
into small triangles, each point is raised by a smooth amount that grows with its
distance from the edge, the front and the back are joined along the outline, and each
side is painted with its own flat. So a change to a measurement or a colour changes the
form with no extra drawing work.

The sizes and colours are made up. Judge the shape and the idea, not the sizes.

| Picture | What it shows |
|---|---|
| `crew-tee-light-front.png` | Straight on from the front, pale body with a navy neckband |
| `crew-tee-light-three-quarter.png` | Turned about 35 degrees and seen a little from above |
| `crew-tee-light-side.png` | From the side (turned about 90 degrees) |
| `crew-tee-light-back.png` | Straight on from the back |
| `crew-tee-red-*.png` | The same four views with a red body and white sleeves and neckband |

In the app, the view sits under the drawing in the editor, behind a **Show in 3D**
button. It says in plain words: *A preview of shape and colour, not of fit or drape.*
It can be turned by dragging, brought closer by scrolling or pinching, and has Front and
Back buttons. When a device asks for less motion, it does not turn by itself.

## How it looks, honestly

- **Front and back, straight on:** convincing as a stylised garment. Colours, the
  neckband, the sleeve seams and the stitching lines all come from the flat. The neck
  opening shows the inside of the back in a darker tone, as the flat does.
- **Turned three quarters:** still reads as a tee. The chest is gently rounded and the
  sleeves have volume.
- **From the side:** it is a cushion. Front and back meet in a sharp ridge along the
  sides, the shoulders and the hem, and the form comes to a point at the neck and at the
  hem. There is no open hem, no open sleeve end and no real neck hole.
- **Shading:** smooth on the body. A slight shadow runs along the hem where the form
  curves back to the edge.
- It is not a body and does not show fit or how fabric hangs. It cannot, from a flat.

## What to decide

- **Accept:** step 9A continues (sleeves as separate volumes, collars and plackets as
  raised detail, the other tops, the e2e test that a change shows within a second).
- **Reject:** the trial is recorded as tried and step 9A moves to layer F (after launch).
  The flat stays the preview. The trial code can be removed with one revert.

To make these pictures again: `pnpm --filter web exec tsx scripts/render-3d-trial.mts`.
