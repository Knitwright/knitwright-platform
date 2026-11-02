import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBaseArticle } from "@/lib/catalogue";
import { partsForSport, type ArticleBook } from "@/lib/teamwear/kit";
import { sportById } from "@/lib/teamwear/vocabulary";
import { crestPixels, crestSize } from "./decode";
import { readCrest, type CrestFile } from "./crest";
import { runCrestToKit } from "./service";
import type { FeelId, RoleChoice } from "./settings";
import { kitsView, type KitsView } from "./view";

/**
 * Joins crest-to-kit to the catalogue and to the picture decoder. It holds no rules of its own:
 * `service.ts` has the pipeline and is tested, and this reads the base articles of the sport and
 * hands the crest's bytes to `decode.ts`.
 *
 * NOTHING IS STORED. The crest is read, its colours are counted from a decoded copy, and both are
 * gone when the answer is sent. There is no table, no bucket and no row behind this screen.
 */

export interface KitsAsk {
  readonly sportId: string;
  readonly feel: FeelId;
  readonly roles: RoleChoice;
  readonly clubName: string | null;
  readonly colours: readonly string[];
  /** The uploaded crest, or null when the club picked colours instead. */
  readonly file: Readonly<{ name: string; bytes: Uint8Array }> | null;
}

export type KitsOutcome = Readonly<{ ok: true; view: KitsView }> | Readonly<{ ok: false; reason: string }>;

/** The base articles behind the parts of a sport, read once. A failed read leaves that part out. */
export async function articlesFor(client: SupabaseClient, sportId: string): Promise<ArticleBook> {
  const codes = [...new Set(partsForSport(sportById(sportId)).flatMap((part) => (part.articleCode === null ? [] : [part.articleCode])))];
  const read = await Promise.all(codes.map((code) => getBaseArticle(client, code).catch(() => null)));
  return new Map(read.flatMap((article) => (article === null ? [] : [[article.code, article] as const])));
}

/** The crest of an uploaded file, with its pixel size measured, or the reason it was refused. */
async function readUpload(file: Readonly<{ name: string; bytes: Uint8Array }>): Promise<Readonly<{ ok: true; crest: CrestFile }> | Readonly<{ ok: false; reason: string }>> {
  const size = await crestSize(file.bytes);
  const read = readCrest(file.name, file.bytes, size);
  return read.ok ? { ok: true, crest: read.crest } : { ok: false, reason: read.message };
}

/** The kits for one ask, as the screen draws them, or the reason there are none. */
export async function kitsFor(client: SupabaseClient, ask: KitsAsk): Promise<KitsOutcome> {
  const upload = ask.file === null ? null : await readUpload(ask.file);
  if (upload !== null && !upload.ok) return upload;
  const crest = upload === null ? null : upload.crest;
  const decoded = crest === null ? null : await crestPixels(crest);
  if (decoded !== null && !decoded.ok) return decoded;
  const run = await runCrestToKit({
    sportId: ask.sportId,
    feel: ask.feel,
    roles: ask.roles,
    clubName: ask.clubName,
    crest,
    pixels: decoded === null ? null : decoded.pixels,
    picked: ask.colours,
    articles: await articlesFor(client, ask.sportId),
  });
  return { ok: true, view: kitsView(run, ask.clubName) };
}
