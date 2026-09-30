/**
 * The live evaluation of sketch and photo input (plan step 13). Needs a provider key (A3),
 * the owner's golden images (A8) listed in lib/intent/golden/images/images.json, and costs
 * real money. Run it from apps/web:
 *
 *   ANTHROPIC_API_KEY=... pnpm --filter web exec tsx scripts/eval-images.mts [model]
 *
 * With no model named it uses INTENT_MODEL (default claude-haiku-4-5). It writes
 * docs/evals/images-<date>-<model>.json (type accuracy with option accuracy beside it, model,
 * date, cost) and lib/intent/golden/images/replay-images.<model>.json (for replay in CI).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allGoldenImageCases } from "@/lib/intent/golden/image-cases";
import { scoreImageCase, summariseImages } from "@/lib/intent/golden/image-replay";
import { startSpec } from "@/lib/intent/golden/replay";
import { runImageIntent } from "@/lib/intent/image-input";
import { rejection } from "@/lib/intent/outcome";
import { DEFAULT_MODEL, MODEL_IDS, modelEntry, spentMicrodollars, type ModelId } from "@/lib/providers/catalog";
import { chooseModels } from "@/lib/providers/select";
import type { ModelImageType, TextModelProvider } from "@/lib/providers/text-model";

/** Right garment type on golden images. A starting target (plan step 13). */
const TARGET = 0.8;
const TYPES: Readonly<Record<string, ModelImageType>> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const here = dirname(fileURLToPath(import.meta.url));
const IMAGES = join(here, "..", "lib", "intent", "golden", "images");
const EVALS = join(here, "..", "..", "..", "docs", "evals");

// Tops, and the other families' cases whose pictures the owner has supplied (A8).
const joined = allGoldenImageCases();
for (const left of joined.skipped) console.warn(`Skipped ${left.id}: ${left.reason}`);
const set = {
  cases: joined.cases,
  status: joined.cases.length > 0 && joined.cases.every((entry) => entry.approved) ? "approved" : "proposed",
};
if (set.cases.length === 0) {
  console.error("The golden image set is empty (owner action A8). Add images and cases first; see the README in that folder.");
  process.exit(1);
}
if (set.status !== "approved") console.warn("The golden image set is not approved (A7). Results are against PROPOSED outcomes.");

const asked = process.argv[2];
const id: ModelId = (MODEL_IDS as readonly string[]).includes(asked ?? "") ? (asked as ModelId) : ((process.env.INTENT_MODEL as ModelId | undefined) ?? DEFAULT_MODEL);
const primary = chooseModels({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, OPENAI_API_KEY: process.env.OPENAI_API_KEY, INTENT_MODEL: id, INTENT_RETRY_MODEL: id }).primary;
if (!primary) throw new Error(`No key is set for ${id}.`);

let last = "";
let cost = 0;
const recorder: TextModelProvider = {
  provider: primary.provider.provider,
  model: primary.provider.model,
  complete: async (request) => {
    const reply = await primary.provider.complete(request);
    last = reply.text;
    cost += spentMicrodollars(modelEntry(id), reply.usage);
    return reply;
  },
};

const responses: Record<string, string> = {};
const scores = [];
for (const entry of set.cases) {
  last = "";
  const mediaType = TYPES[extname(entry.file).toLowerCase()];
  const image = { mediaType, base64: readFileSync(join(IMAGES, entry.file)).toString("base64") };
  const outcome = await runImageIntent({ spec: startSpec(entry.start), image }, recorder).catch(() => rejection("The call failed."));
  responses[entry.id] = last;
  scores.push(scoreImageCase(entry, outcome));
}

const summary = summariseImages(scores);
const date = new Date().toISOString().slice(0, 10);
const typeAccuracy = summary.typeScored === 0 ? 0 : summary.typeCorrect / summary.typeScored;
mkdirSync(EVALS, { recursive: true });
writeFileSync(
  join(EVALS, `images-${date}-${id}.json`),
  `${JSON.stringify({ model: id, date, target: TARGET, setStatus: set.status, summary, typeAccuracy, costMicrodollars: cost, costPerImageMicrodollars: cost / set.cases.length, wrong: scores.filter((score) => !score.kindCorrect || score.typeCorrect === false || score.optionsCorrect === false) }, null, 2)}\n`,
);
writeFileSync(join(IMAGES, `replay-images.${id}.json`), `${JSON.stringify({ synthetic: false, source: `Recorded from ${id} on ${date}.`, responses }, null, 2)}\n`);
console.log(`${id}: type right on ${(typeAccuracy * 100).toFixed(1)}% (target ${TARGET * 100}%), options ${summary.optionsCorrect}/${summary.optionsScored}.`);
