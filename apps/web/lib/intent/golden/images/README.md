# Golden images for tops

This folder is empty on purpose. The images are owed by the owner:

- **A8**: draw or photograph 40 tops pictures. No third-party brand images. Include a few
  pictures that are not garments (a shoe, a room, a logo on its own) to check the explained
  rejection.
- **A7**: approve the expected outcome of each case.

## Adding a case

1. Put the picture here with a short lower-case name: `polo-sketch-01.png`, `jersey-photo-03.jpg`
   (PNG, JPEG or WebP).
2. Add a case to `images.json`:

   ```json
   {
     "id": "img-001",
     "file": "polo-sketch-01.png",
     "kind": "sketch",
     "start": { "typeId": "crew-tee" },
     "expected": { "kind": "proposal", "typeId": "polo", "options": { "sleeve-length": "short" } },
     "approved": false
   }
   ```

   `start` is the design the picture is read against. `expected` is either the garment type (and
   any options to score) the picture should be read as, or `{ "kind": "rejection" }` for a picture
   that is not a garment. Set `approved` to `true` only when the owner has approved the case, and
   `status` to `"approved"` when every case is.

## Running it

With a provider key (A3), from `apps/web`:

```
ANTHROPIC_API_KEY=... pnpm exec tsx scripts/eval-images.mts
```

It writes `docs/evals/images-<date>-<model>.json` (right garment type against the 80% starting
target, with option accuracy beside it, and the cost) and `replay-images.<model>.json` here. The
unit tests replay every `replay-images.*.json` in CI with no model call
(`lib/intent/golden/image-replay.test.ts`).
