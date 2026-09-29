# 0006: Size charts and how a measurement is worked out

Status: Accepted. No chart data yet: it waits for the owner (action A5).
Date: 2026-09-29
Plan step: 5

## Context

The registry says which measurements a garment has. It holds no numbers. The numbers
come from size charts that the owner supplies or approves. The plan forbids inventing
them. When this step was built the owner had not sent any.

## Decision

1. **`lib/sizing` is a pure library** that reads chart text and gives data. It ships
   with no chart data. `lib/sizing/charts/index.ts` exports empty lists.
2. **With no chart, the answer says so** in a plain sentence. It is never a zero and
   never a guess.
3. **Tests use numbers that are plainly made up**, kept in `lib/sizing/fixtures/`. A test
   fails if the shipped charts ever import them.
4. **A chart must name a person and a date as its source.** A chart without both is
   refused.
5. **A chart is read from the owner's CSV format**, described in
   `docs/owner/size-charts.md`. Each problem names its line and column. Centimetres are
   read as text, so 52.5 cm is exactly 5250 tenths of a millimetre.
6. **The order of precedence** is the chart, then the chart for the chosen fit, then a
   value the brand or user set. A value set by a person keeps its own source. The other
   sizes are worked out from it with the chart's steps and are marked as worked out.
7. **A design uses its own sizes and base size** once they are set. The chart is matched
   by size label. A size the chart does not have gives missing rows, not guesses.
8. **A value that is missing is returned as missing**, with a sentence, and has no
   number at all.

## Evidence

| Claim | Test |
|---|---|
| Every tops type resolves for every size of every chart that applies | `lib/sizing/resolve.test.ts`, with made-up charts for all five types and three wearers |
| No default chart lacks a named source | `lib/sizing/default-charts.test.ts` |
| Grading never makes a larger size smaller, and never gives zero or less | `lib/sizing/grading.test.ts`, property-based |
| Every value has a source, and none is called checked | `lib/sizing/resolve.test.ts` |
| Coverage of `lib/sizing` is at least 90% | Threshold set in `vitest.config.mts` |

## Open for the owner

`apps/web/lib/sizing/OWNER-QUESTIONS.md`: whether tolerance differs above and below,
whether other sizes keep the chart's steps or its ratios when one value is changed,
whether the base size can differ by measurement, and whether a grade step may be zero.

## Consequences

- Until charts arrive, a new design has no suggested measurements. The editor shows each
  as missing and the brand types its own.
- Charts owned by a brand are not stored yet. That comes with the import in step 25.
