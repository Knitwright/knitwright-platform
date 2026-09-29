/**
 * The live evaluation of text input (plan step 12, tasks 2 and 6). Needs real provider keys
 * (owner action A3) and costs real money: roughly the per-request cost in the catalog times
 * the number of golden cases, for each model tried. Run it from apps/web:
 *
 *   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... pnpm --filter web exec tsx scripts/eval-text.mts [model ...]
 *
 * With no model named, candidates are tried from cheapest to dearest and it stops at the
 * first that reaches the target. Each run writes docs/evals/text-<date>-<model>.json (the
 * summary, with model name, date and cost) and lib/intent/golden/replay-tops.<model>.json
 * (the replies, for replay in CI). See docs/evals/README.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import golden from "@/lib/intent/golden/tops.json";
import { evaluateText, selectModel } from "@/lib/intent/golden/live-eval";
import { goldenSetSchema } from "@/lib/intent/golden/replay";
import { MODEL_CATALOG, MODEL_IDS, modelEntry, type ModelId } from "@/lib/providers/catalog";
import { chooseModels } from "@/lib/providers/select";

/** Correct outcomes on the golden set. A starting target; the owner may change it (plan step 12). */
const TARGET = 0.9;

const here = dirname(fileURLToPath(import.meta.url));
const EVALS = join(here, "..", "..", "..", "docs", "evals");
const RECORDINGS = join(here, "..", "lib", "intent", "golden");

const set = goldenSetSchema.parse(golden);
if (set.status !== "approved") {
  console.warn("The golden set is not approved by the owner (A7). The accuracy below is against PROPOSED outcomes.");
}

const named = process.argv.slice(2).filter((arg): arg is ModelId => (MODEL_IDS as readonly string[]).includes(arg));
const candidates: ModelId[] = named.length > 0 ? named : MODEL_CATALOG.map((entry) => entry.id);
const date = new Date().toISOString().slice(0, 10);

const run = async (id: ModelId) => {
  const primary = chooseModels({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, OPENAI_API_KEY: process.env.OPENAI_API_KEY, INTENT_MODEL: id, INTENT_RETRY_MODEL: id }).primary;
  if (!primary) throw new Error(`No key is set for ${id}.`);
  const report = await evaluateText({ cases: set.cases, provider: primary.provider, entry: modelEntry(id), date });
  mkdirSync(EVALS, { recursive: true });
  const { recording, scores, ...summary } = report;
  writeFileSync(join(EVALS, `text-${date}-${id}.json`), `${JSON.stringify({ ...summary, target: TARGET, goldenStatus: set.status, wrong: scores.filter((score) => !score.correct) }, null, 2)}\n`);
  writeFileSync(join(RECORDINGS, `replay-tops.${id}.json`), `${JSON.stringify(recording, null, 2)}\n`);
  console.log(`${id}: ${(report.accuracy * 100).toFixed(1)}% correct, ${report.costPerRequestMicrodollars.toFixed(0)} microdollars a request.`);
  return report;
};

const runAll = async () => {
  const reports = [];
  for (const id of candidates) reports.push(await run(id));
  return { chosen: null, reports };
};

const result = named.length > 0 ? await runAll() : await selectModel(candidates, TARGET, run);
console.log(result.chosen ? `Chosen: ${result.chosen}. Set INTENT_MODEL=${result.chosen}.` : "No model chosen.");
