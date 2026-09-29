# Evaluations of the assistant

No evaluation has been run yet. The provider keys (owner action A3) do not exist, and the golden
set is proposed, not approved (owner action A7). Nothing in this folder is a result until a file
named below appears, written by the harness.

## Text input (plan step 12)

Target: correct outcome on at least 90% of the golden set (a starting target the owner may change).

1. Approve the golden set: `apps/web/lib/intent/golden/tops.json` (see `lib/intent/OWNER-QUESTIONS.md`).
2. Create paid-tier keys and set a monthly spend limit in each provider's console.
3. From `apps/web`, with the keys in the environment (never in a file that is committed):

   ```
   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... pnpm exec tsx scripts/eval-text.mts
   ```

   With no model named, the candidates in `lib/providers/catalog.ts` are tried cheapest first and
   the run stops at the first that reaches the target. Name models to run only those:
   `pnpm exec tsx scripts/eval-text.mts gpt-5-nano claude-haiku-4-5`.
   Cost: about the per-request price in the catalog times about 200 cases, per model tried.
4. Each model run writes:
   - `docs/evals/text-<date>-<model>.json`: model name, date, accuracy, never-silent count, garment
     type and option accuracy, cases answered by the rules, failed calls, total cost and cost per
     request (from the tokens the vendor reported), and every wrong case.
   - `apps/web/lib/intent/golden/replay-tops.<model>.json`: the replies, which the unit tests
     replay in CI with no model (`replay.test.ts` picks up every such file).
5. Set `INTENT_MODEL` to the chosen model. Keep `INTENT_RETRY_MODEL` on a stronger one.
6. Commit the two files and add a line to the table below.

The run goes through the same path as the product: the guard, the rules, then the model, with no
retry, so the number is the first model's own.

| Date | Model | Correct | Type | Options | Cost a request | File |
|---|---|---|---|---|---|---|
| (none yet) | | | | | | |
