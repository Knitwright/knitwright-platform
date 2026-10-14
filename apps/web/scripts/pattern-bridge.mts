/**
 * The local pattern bridge. While PATTERN_PROVIDER=claude-bridge, the app queues pattern
 * requests and the owner's own Claude session drafts them through FashionInsta, then hands
 * the files back with this script. It reads apps/web/.env.local and writes with the server's
 * key. With --remote it works on the hosted project instead, reading NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SECRET_KEY from apps/web/.env.bridge.local (never committed). On the live site
 * only OWNER_EMAIL can ask for a pattern (lib/patterns/access.ts).
 *
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts list
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts start <job id>
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts complete <job id> --dxf <file> --draft <name>
 *        [--preview <png file>] [--pieces <n>] [--notes <json file holding a list of sentences>]
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts complete-set <job id> (--dxf-dir <folder of DXFs, one or more sizes each> | --dxf <one DXF of every size>)
 *        --draft <name> [--outline net|gross] [--size-order XS,S,M,L]
 *        Reads every size, adds the seam allowance and notches a file lacks, runs the checks, measures every size, and stores a
 *        block of the pattern library. A set whose front and back do not sew together is refused with the seam named.
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts fail <job id> "<sentence to show>"
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildSet } from "@/lib/pattern-library/set";
import {
  completePatternJob,
  completePatternSetJob,
  failPatternJob,
  markPatternRunning,
  openPatternJobs,
} from "@/lib/patterns/service";

const remote = process.argv.includes("--remote");
const envFile = resolve(import.meta.dirname, remote ? "../.env.bridge.local" : "../.env.local");
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [match[1], match[2]]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error(`NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be in ${envFile}.`);
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
if (remote === isLocal) throw new Error(remote ? "--remote needs the hosted project's address." : "Without --remote the bridge works on the local database only.");

const admin = createClient(url, key, { auth: { persistSession: false } });

const [command, jobId, ...rest] = process.argv.slice(2).filter((argument) => argument !== "--remote");

const flag = (name: string): string | undefined => {
  const at = rest.indexOf(`--${name}`);
  return at === -1 ? undefined : rest[at + 1];
};

const need = (value: string | undefined, what: string): string => {
  if (!value) throw new Error(`Give ${what}.`);
  return value;
};

switch (command) {
  case "list": {
    process.stdout.write(`${JSON.stringify(await openPatternJobs(admin, "claude-bridge"), null, 2)}\n`);
    break;
  }
  case "start": {
    process.stdout.write(`${(await markPatternRunning(admin, need(jobId, "a job id"))) ? "running" : "not queued"}\n`);
    break;
  }
  case "complete": {
    const notesFile = flag("notes");
    const preview = flag("preview");
    await completePatternJob(admin, need(jobId, "a job id"), {
      dxf: new Uint8Array(readFileSync(need(flag("dxf"), "--dxf <file>"))),
      preview: preview ? new Uint8Array(readFileSync(preview)) : null,
      draft: need(flag("draft"), "--draft <name>"),
      pieces: flag("pieces") ? Number(flag("pieces")) : null,
      notes: notesFile ? (JSON.parse(readFileSync(notesFile, "utf8")) as string[]) : [],
    });
    process.stdout.write("completed\n");
    break;
  }
  case "complete-set": {
    const dir = flag("dxf-dir");
    const single = flag("dxf");
    const files = dir
      ? readdirSync(resolve(dir)).filter((name) => /\.dxf$/i.test(name)).sort().map((name) => ({ name, text: readFileSync(join(resolve(dir), name), "utf8") }))
      : [{ name: need(single, "--dxf-dir <folder> or --dxf <file>"), text: readFileSync(resolve(need(single, "--dxf <file>")), "utf8") }];
    const outline = flag("outline");
    if (outline !== undefined && outline !== "net" && outline !== "gross") throw new Error("--outline is net or gross.");
    const order = flag("size-order");
    const built = buildSet({ files, outline: outline ?? null, sizeOrder: order ? order.split(",").map((size) => size.trim()) : undefined });
    if (!built.ok) {
      process.stdout.write(`${built.reasons.join("\n")}\n`);
      await failPatternJob(admin, need(jobId, "a job id"), built.reasons[0]);
      process.exitCode = 1;
      break;
    }
    const made = await completePatternSetJob(admin, need(jobId, "a job id"), { set: built, draft: need(flag("draft"), "--draft <name>") });
    process.stdout.write(`stored block ${made.blockId} version ${made.version}: ${built.sizes.length} sizes\n${built.questions.map((q) => `ask: ${q}`).join("\n")}\n`);
    break;
  }
  case "fail": {
    await failPatternJob(admin, need(jobId, "a job id"), need(rest.join(" "), "a sentence to show"));
    process.stdout.write("failed\n");
    break;
  }
  default:
    throw new Error("Commands: list, start, complete, complete-set, fail.");
}
