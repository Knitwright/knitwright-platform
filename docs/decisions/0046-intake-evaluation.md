# 0046: Intake test set and evaluation harness

Status: Accepted. The test set waits for the owner (A7); no live run has been made.
Date: 2026-10-24
Plan step: V8 (plan v4)

## Context

The spec's acceptance for stage 1 is that 95% of a 200-prompt test set maps to the right article,
that nothing is created outside the catalogue, and that a jersey photo maps to article and colours
in under 10 seconds. The golden sets of decisions 0013, 0019 and 0020 test the assistant changing
an existing design; none tests choosing the article at the start.

## Decision

1. **A separate test set** of 200 prompts (`lib/intent/eval/fixtures/prompts.json`), each with the
   registry's answer as of 2026-10-24: an article, a plain refusal with the nearest block and the
   difference in one line, or a question with candidates. Prompts that need V2's football and cricket
   articles carry `pending_catalogue` and are scored separately.
2. **One reader interface** (`Observer`: prompt in, prediction, colours, latency and cost out), with
   three readers: the vocabulary matcher (`findMentions`, free), a model reader over the existing
   `TextModelProvider`, and a stand-in model that answers from the fixtures.
3. **Nothing outside the catalogue is a count.** Any article id a reader names is checked against
   the registry, and an unknown id is "invented", always wrong.
4. **CI is free.** The unit tests validate the fixtures against the registry and run the whole
   harness with the stand-in; they must score 100% or the fixtures and the parser disagree. The
   live reader runs only from a person's terminal, with a cost cap that refuses a call whose worst
   case would pass it.
5. **Own instructions for the model reader.** It does not reuse the assistant's change-a-design
   route, which needs a design to change. Its instructions are generated from the registry.

## Evidence

- Unit tests for each piece; coverage of `lib/intent/eval` is 99.5% of statements.
- The deterministic baseline, run once: 117 of 188 (62.2%), 0 invented. See `docs/evals/intake-2026-10.md`.
- The stand-in scores 188 of 188. That proves the harness, not any model.
- **No model was called.** There is no measured model accuracy, latency or cost.

## Alternatives

- **Reuse the golden set format.** Lost: its cases are edits to a design; here there is no design.
- **Score ambiguous prompts as correct when any plausible article is chosen.** Lost: the product
  should ask. A guess that happens to match is scored wrong.
- **Run the live reader through the per-brand allowance.** Lost: a manual run has no brand. The
  explicit cost cap stands in for it.

## Consequences

- Improving the vocabulary or adding a model moves one number that can be rerun in seconds.
- The expected answers go stale when V2 merges. The pending ids are provisional.
- The test set was written by the workstream, so it reflects its wording, not real users'.

## Owner questions

1. **Approve or change the 200 prompts (A7).** Judgement calls to look at first: "rashie" and "base
   layer" as compression top, "training bibs" as vest, "full kit" as shirt plus shorts, and whether
   a football shirt stays the team jersey or becomes its own article in V2.
2. **Is the 95% over all 200, or over the catalogue ones?** Today: over the 188 answerable now; the
   12 pending are reported apart. And is a good question ("which hoodie?") a right answer?
3. **Real prompts.** Can the partner club or first users supply 50 to 100 real messages to replace
   invented ones?
4. **Jersey photos (A8).** About 20 photos with the article and colours read by a person, so the
   10-second claim can be tested at all.
5. **Live run.** Which model to try first, and the spend limit. Default cap is $0.50 a run.
6. **Colour tolerance.** CIE76 difference of 20 is our setting. Is it acceptable?
