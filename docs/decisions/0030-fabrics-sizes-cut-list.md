# 0030: Fabrics, Australian sizes and the cut list

Status: Proposed
Date: 2026-10-15
Plan step: `plans/production-outputs.md`, workstream W2

## Context

The fashionINSTA benchmark states a stretch reduction (5 %) with no fabric data behind it, tells the
printer to "pre-shrink 1 to 3 %" without a test, and gives fabric use as "~1.2 m, confirm from
marker". It drafts one size. Knitwright had stretch as a category on each design and no library of
fabrics, no Australian labels beyond the starter runs, and no cut list.

## Decision

1. **A base-fabric library per brand** (`base_fabrics`). A fabric holds what its supplier's sheet
   states. The three fabrics the benchmark names are added the first time a brand opens the library,
   with every number empty.
2. **Fabric tests are the only source of "fabric test"** (`fabric_tests`): who, when, how, the load
   a stretch was pulled at, the heat and time a shrink was pressed at, with photos by file id. The
   server can add a test and never change it, so a release can name the test it used. A fabric's
   profile is its sheet with each tested number taken from the newest test that measured it.
3. **Print scale is the contract's `printScale`.** 2.0 % length and 1.5 % width shrink gives
   1.0204 by 1.0152; with no test it is 1 and the result carries "Not scaled for shrink".
4. **`stretchReduction(fabric, block)` compares, never decides.** It warns when the block's
   reduction exceeds the fabric's stretch, when the fabric stretches less than the benchmark's own
   rule of about four times the reduction, and when a test found a different reduction right.
5. **Australian sizes add no measurement.** Men's and women's labels use the starter chart at the
   same label; junior 6 to 16 use the nearest youth column; women's 3XL has no value because no
   source read gives one. `size_label_maps` holds a brand's own choice of pattern size per label; the
   shipped default is "suggested" and the readiness item `size-label-map` stays open while any label
   is only suggested.
6. **A cut list from the pattern, per size** (`lib/cutting`): piece, quantity, mirrored, fold, grain,
   fabric, notch marks actually present, whole-piece area. Fabric use is piece area over usable width
   times efficiency, where efficiency is a setting (80 %) labelled "Knitwright default, not from a
   marker". A `MarkerProvider` interface and a strip-packing estimator (a box round each piece, grain
   along the fabric) carry the same label. `fabricUseFor(order)` gives the totals the instant price
   will read; the price is not built here.

## Evidence

Unit tests: the jersey EU 48 fixture gives four piece types with quantities 1, 1, 2, 1, on fold,
mirrored; print scale 1.0204 by 1.0152; a block reduction of 5 % against 3 % of stretch warns; every
fabric number's source is read back. DB tests (CI): row level security on the three tables,
append-only tests, check constraints on load and press.

## Alternatives

- Storing tested numbers on the fabric row: rejected, it loses who and when and lets a value change
  under a release.
- Adding 3XL to the women's starter run with an extrapolated grade: rejected, it is a guess.
- A real nesting engine now (blueprint layer C, candidate `spyrrow`): left behind `MarkerProvider`.

## Consequences

Fabric use is an estimate until a marker or the factory gives an efficiency (owner input P9). Print
files stay unscaled until a fabric is tested (P4). The size map stays "suggested" until the owner sets
it (P3).
