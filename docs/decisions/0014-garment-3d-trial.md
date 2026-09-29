# 0014: A 3D form made from the flat (trial)

Status: Trial, awaiting owner verdict A10
Date: 2026-09-29
Plan step: 9A (task 1 only)

## Context

The landing page promises that the flat, the table and a 3D garment move together. No
3D assets exist, and draping from pattern pieces needs patterns, which come after launch.
Step 9A says to try, for the crew tee, a form built from the flat itself, and to let the
owner judge it (A10) before anything more is built.

## Decision

1. **The form is a pure function of the geometry model** (`lib/garment3d/mesh.ts`,
   `buildGarmentMesh`). It takes only the outline and the drawing box of each view
   (`ShapeSource`), so no drawing code is duplicated. Units are metres, y up.
2. **Triangles:** the back silhouette is the border. The parts of the front silhouette
   that lie inside it (the deeper front neck) are followed as lines. Points are spread on
   a grid of equal triangles and joined with Delaunator (`delaunator` 5.1.0, pinned). A
   border segment the triangles miss is split and the work is redone; an inside edge
   that joins two border points is split as well, so front and back never pinch.
3. **Volume:** each inside point rises by `depth × sqrt(1 − (1 − d/R)²)`, where d is its
   distance from the edge of its own side's silhouette and R the greatest such distance.
   The rise meets the edge upright, like a rounded rim. Ten passes of smoothing remove the
   creases a distance field has. Front and back share the vertices on the border, so the
   form is closed by construction. Between the front neck and the back neck the front is
   flat, and shows what the flat shows there: the inside of the back.
4. **Texture:** each side is painted with its own flat SVG, the same one the editor
   shows. The back is mirrored, because the back flat is drawn as seen from behind.
5. **Viewer:** three.js 0.186.1, pinned, in one file (`components/garment3d/scene.ts`)
   with OrbitControls for turning and zoom, Front and Back buttons, and no motion by
   itself when the device asks for less motion. It is labelled "A preview of shape and
   colour, not of fit or drape."
6. **Loaded only when opened:** a **Show in 3D** button under the drawing in the editor
   loads the viewer with `next/dynamic` (no server render). An architecture test keeps
   three.js, Delaunator and the form builder out of every other file.

## Evidence

- Tests (task 7): for all five tops types the form is closed (every edge joins exactly
  two faces, running opposite ways), no face is inverted, and the enclosed volume is
  positive. Width and length equal the flat silhouette's, in metres, and follow a change
  to the chest in the same ratio. Texture coordinates land where the flat has the same
  point. The builder is deterministic and changes nothing it is given.
- Screenshots in `docs/owner/3d/`, drawn in headless Chrome with the real scene code by
  `apps/web/scripts/render-3d-trial.mts`. No app server was used.
- Crew tee with made-up sizes: 2306 vertices and 4206 triangles a side, built in about
  0.26 s in Node on the development machine. The one-second budget for a change holds
  for the form; the texture paint time in a browser was not measured.
- My own look at the pictures: straight on, front and back are convincing as a stylised
  tee, colours and neckband carried from the flat. From the side it is a cushion: a sharp
  ridge where front meets back, points at the neck and the hem, no open hem, sleeve ends or
  neck hole.

## Alternatives

- **Earcut** (ear clipping) was the plan's suggestion. It uses only the outline's own
  points, so the triangles are long slivers and the inside cannot be raised smoothly;
  Steiner points are not supported. Delaunator is from the same maintainers, small,
  current (2026), and ships its own types.
- **A constrained triangulation library** (cdt2d, poly2tri, constrainautor): heavier or
  less maintained. Splitting missed border segments gives the same result here.
- **Sleeves and collars as separate volumes** are task 4, after A10.
- **Draping from patterns**: after launch; needs patterns.

## Consequences

- Every change to the flat changes the form, with no 3D assets and nothing to run on a
  server.
- It is stylised: a cushion from the side. Tasks 4 (sleeves, collars) would soften that.
- The editor's data now carries each side's outline and drawing box (a few kilobytes) for
  the viewer, even when the view is never opened.
- Not done in the trial: the bundle report (the architecture test stands in for it), the
  e2e test that a change shows within a second, the tech pack page, sleeves as separate
  volumes, collars and plackets as raised detail.
- Revisit if the owner rejects it (A10): move step 9A to layer F and revert this branch.
