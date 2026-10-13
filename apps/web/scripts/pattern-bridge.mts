/**
 * The local pattern bridge. While PATTERN_PROVIDER=claude-bridge, the app queues pattern
 * requests and the owner's own Claude session drafts them through FashionInsta, then hands
 * the files back with this script. Local only: it reads apps/web/.env.local and writes with
 * the server's key.
 *
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts list
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts start <job id>
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts complete <job id> --dxf <file> --draft <name>
 *        [--preview <png file>] [--pieces <n>] [--notes <json file holding a list of sentences>]
 *   pnpm --filter web exec tsx scripts/pattern-bridge.mts fail <job id> "<sentence to show>"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  completePatternJob,
  failPatternJob,
  markPatternRunning,
  openPatternJobs,
} from "@/lib/patterns/service";

const envFile = resolve(import.meta.dirname, "../.env.local");
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
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error("The pattern bridge runs against the local database only.");

const admin = createClient(url, key, { auth: { persistSession: false } });

const [command, jobId, ...rest] = process.argv.slice(2);

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
  case "fail": {
    await failPatternJob(admin, need(jobId, "a job id"), need(rest.join(" "), "a sentence to show"));
    process.stdout.write("failed\n");
    break;
  }
  default:
    throw new Error("Commands: list, start, complete, fail.");
}
