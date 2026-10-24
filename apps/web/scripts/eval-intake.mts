/**
 * The intake evaluation (plan v4, V8): 200 prompts scored for article, colours, refusal and
 * nearest block, latency and cost. Run from the repository root:
 *
 *   pnpm --filter web eval:intake                       the vocabulary matcher, no model, free
 *   pnpm --filter web eval:intake stub                  a stand-in model that answers from the fixtures, free
 *   pnpm --filter web eval:intake live <model> [--max-cost <microdollars>] [--limit <n>] [--write]
 *
 * `live` calls a paid model with your own key (ANTHROPIC_API_KEY or OPENAI_API_KEY) and is for a
 * person to run by hand: never from CI. It refuses any call that could take the run over the cap
 * (default 500,000 microdollars, which is $0.50). It does not go through the product's per-brand
 * allowance, because a manual run has no brand. `--write` saves the summary to docs/evals/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "@/lib/intent/eval/fixtures/prompts.json";
import { baselineObserver, createOracleProvider, formatReport, fixtureSchema, intakeObserver, runEvaluation } from "@/lib/intent/eval";
import { MODEL_IDS, modelEntry, type ModelId } from "@/lib/providers/catalog";
import { chooseModels } from "@/lib/providers/select";

const DEFAULT_CAP = 500_000;
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mode = args[0] ?? "baseline";
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const fixtures = fixtureSchema.parse(prompts);
const limit = flag("--limit") === undefined ? fixtures.cases.length : Number(flag("--limit"));
const cases = fixtures.cases.slice(0, Number.isInteger(limit) && limit > 0 ? limit : fixtures.cases.length);
const cap = flag("--max-cost") === undefined ? DEFAULT_CAP : Number(flag("--max-cost"));
if (!Number.isFinite(cap) || cap <= 0) throw new Error("--max-cost must be a positive number of microdollars.");

function observer() {
  if (mode === "baseline") return { label: "vocabulary matcher, no model", observe: baselineObserver };
  if (mode === "stub") {
    return { label: "stand-in model (answers from the fixtures; proves the harness, not a model)", observe: intakeObserver({ provider: createOracleProvider(fixtures.cases), entry: modelEntry("claude-haiku-4-5"), maxCostMicrodollars: cap }) };
  }
  if (mode === "live") {
    const id = args[1] as ModelId;
    if (!(MODEL_IDS as readonly string[]).includes(id)) throw new Error(`Name a model: ${MODEL_IDS.join(", ")}.`);
    const chosen = chooseModels({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, OPENAI_API_KEY: process.env.OPENAI_API_KEY, INTENT_MODEL: id, INTENT_RETRY_MODEL: id }).primary;
    if (!chosen) throw new Error(`No key is set for ${id}.`);
    return { label: `live ${id}`, observe: intakeObserver({ provider: chosen.provider, entry: chosen.entry, maxCostMicrodollars: cap }) };
  }
  throw new Error("Mode is baseline, stub or live.");
}

const { label, observe } = observer();
const run = await runEvaluation(cases, observe);
console.log(formatReport(label, run));
if (fixtures.status !== "approved") console.log("The test set is proposed, not approved by the owner (A7).");

if (args.includes("--write")) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(here, "..", "..", "..", "docs", "evals");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `intake-${date}-${label.replace(/[^a-z0-9.-]+/gi, "-").replace(/-+$/, "").toLowerCase()}.json`);
  writeFileSync(file, `${JSON.stringify({ label, date, testSetStatus: fixtures.status, summary: run.summary, skipped: run.skipped, wrong: run.scores.filter((s) => !s.correct) }, null, 2)}\n`);
  console.log(`Wrote ${file}`);
}
