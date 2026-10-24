# 0052: Football and cricket starter templates (W2-F)

Status: Proposed
Date: 2026-10-25
Plan step: platform v4 wave 2, workstream W2-F (`plans/platform-v4.md`). Builds on 0040 (articles) and 0041 (library).

## Decision

1. **21 starters, three per article**, for the seven new articles that have a flat: football shirt, football shorts, goalkeeper shirt, football training top, cricket shirt, cricket trousers, cricket training tee. None for socks, the cap or the winter code slot. Files: `lib/templates/seed/teamwear/build.ts`; `lib/templates/seed/all.ts` joins them to the first twelve, and `seedTemplates` writes all 33.
2. **Built from the article's real options and colour blocking, not kit patterns.** `kitPatternFits` allows kit patterns on the tops family only, and these articles are in the football and cricket families, so `set-kit-pattern` is refused. The starters therefore use the "plain" style tag, real options (v neck, raglan, zip, contrast side panels, side stripe, zipped pockets, padded elbows) and a body, sleeve and trim colour per panel the article really has. Colours are the person's own choice (`user-edited`) and screen colours only.
3. **No measurement.** These articles have no starter size chart, so no size or measurement is set. Nothing is invented.
4. **Deterministic**, and every starter carries "Knitwright starter, not reviewed by a factory".
5. **Sport tags** are `football` and `cricket`; a test checks the filter by sport and by article.
6. **Shared test change**: `seed.test.ts` counts and `e2e/templates.spec.ts` (cricket count) now derive from `allSeedTemplates()`.

## Owner questions

1. Should kit patterns (hoops, stripes, sash) be drawn on football and cricket articles? It needs `PATTERN_FAMILIES` in `lib/garment/kit-pattern.ts` and the flat drawing to change, which this workstream does not own.
2. Which real clubs' kits should replace these colour choices once a factory reviews them?
3. Should youth starters exist before a youth size chart does?

## Evidence

`lib/templates/seed/teamwear/build.test.ts` (valid, copy path, flats, filters); `e2e/templates.spec.ts` (filter football, use, version 1; not run here, no Docker in the sandbox).
