# Patterns

`fashioninsta-mens-knit-tee-50.dxf` is the first sample from fashionINSTA. The pattern library
(decision 0029) now stores whole size sets.

To put a size run in the library from fashionINSTA's size-set tool:

1. In the app, open a design, then the tech pack's Patterns section, choose the base size and press
   "Make every size". That queues a job.
2. Save the DXF files fashionINSTA gives you into one folder (one file per size, or one file with
   every size).
3. Run the bridge from `apps/web`:

   ```
   pnpm exec tsx scripts/pattern-bridge.mts list
   pnpm exec tsx scripts/pattern-bridge.mts complete-set <job id> --dxf-dir <folder> --draft <block name> [--outline net|gross]
   ```

   Give `--outline` if the files do not say whether the outline already includes seam allowance;
   otherwise the library keeps asking in the pattern's page. A set whose front and back do not
   sew together (side or shoulder seams more than 2 mm apart) is refused with the seam named.

Your own technician's or brand's DXF files go in through Make it, Patterns, "Add a pattern from DXF
files". Every pattern says "Draft pattern, not reviewed." until a named person records a review there.
