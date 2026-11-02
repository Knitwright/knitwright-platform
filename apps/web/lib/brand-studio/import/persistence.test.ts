import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE } from "../types";
import { planOf } from "./apply";
import { decideKind, tickRights } from "./decisions";
import { runImport, type ImportDeps } from "./run";
import { DEFAULT_IMPORT_SETTINGS } from "./settings";
import { createStubStyleWriter } from "./style";
import { SITE, allows, fakeFetcher, kitFonts, siteRoutes } from "./fixtures/site";

/**
 * **The spec rule this feature rests on.** F-S1 and F-S2's storage rule, repeated in the plan: no
 * third-party HTML and no third-party image is ever stored. An import fetches, derives and
 * discards. The one exception is a picture of the brand's **own**, kept as their own upload and
 * only behind an explicit rights tick recorded with the file.
 *
 * This file proves it four ways:
 *
 * 1. **Nothing in this directory can write.** No file imports a database client, a storage writer,
 *    a Supabase client or a server action, so there is no path from here to a row or a file.
 * 2. **No shape can carry markup or bytes.** A whole proposal from a real run is serialised and
 *    searched for a tag, a base64 blob and a byte array; and `types.ts` names no byte type at all.
 * 3. **Nothing of the page survives.** The words, the markup and the picture bytes are gone from
 *    the proposal: only numbers, colours, family names and the brand's own addresses remain.
 * 4. **Nothing is uploaded without the tick.** The plan an accepted import produces asks for no
 *    upload while the box is unticked, whatever was accepted.
 */

const DIR = join(__dirname);
const SOURCES = readdirSync(DIR, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && /\.ts$/.test(entry.name) && !/\.test\./.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name));

const textOf = (path: string): string => readFileSync(path, "utf8");

/** The code without its comments, so a comment that names a forbidden thing is not read as one. */
const codeOf = (path: string): string => textOf(path).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** Every module each file imports from. */
const importsOf = (text: string): string[] => [...text.matchAll(/^(?:import|export)[^;]*?from\s+"([^"]+)"/gm)].map((match) => match[1] ?? "");

describe("the files of this directory", () => {
  it("are found", () => {
    expect(SOURCES.length).toBeGreaterThan(10);
  });

  it("import no database client, no storage writer and no server action, so none of them can write", () => {
    const forbidden = /@supabase|@\/lib\/storage\/store|@\/lib\/server\/define-|@\/lib\/supabase|\/actions$|@\/lib\/brand-studio\/service/;
    const offenders = SOURCES.flatMap((path) => importsOf(textOf(path)).filter((module) => forbidden.test(module)).map((module) => `${path}: ${module}`));
    expect(offenders).toEqual([]);
  });

  it("call no insert, update, upsert, delete or rpc anywhere", () => {
    const writes = /\.(insert|update|upsert|delete|rpc)\s*\(/;
    expect(SOURCES.filter((path) => writes.test(textOf(path)))).toEqual([]);
  });

  it("name no byte or base64 type in the shapes they hand back", () => {
    expect(codeOf(join(DIR, "types.ts"))).not.toMatch(/Uint8Array|ArrayBuffer|Buffer|base64|blob/i);
  });

  it("read bytes in exactly two places, and both of them drop them", () => {
    const readsBytes = SOURCES.filter((path) => /arrayBuffer|Uint8Array|Buffer\.from/.test(codeOf(path)));
    expect(readsBytes.map((path) => path.split("/").pop()).sort()).toEqual(["fetch.ts", "pictures.ts", "run.ts", "site.ts"]);
  });
});

const deps = async (): Promise<ImportDeps> => ({
  fetcher: fakeFetcher(await siteRoutes()),
  limiter: allows,
  styleWriter: createStubStyleWriter(),
  kitFonts: kitFonts(),
  settings: DEFAULT_IMPORT_SETTINGS,
  now: () => new Date("2026-11-02T09:00:00.000Z"),
});

describe("a whole proposal from a real run", () => {
  const who = { brandId: "b1", userId: "u1" };
  const input = { url: `${SITE}/`, brandName: "Ravensmoor Athletic" };

  it("holds no markup: not a tag, not a comment, not an entity", async () => {
    const run = await runImport(await deps(), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    const serialised = JSON.stringify(run.proposal);
    expect(serialised).not.toMatch(/<[a-z!/]/i);
    expect(serialised).not.toMatch(/&(?:[a-z]{2,10}|#\d{1,6});/i);
    expect(serialised).not.toContain("Made in the north since 1897");
  });

  it("holds no picture: no base64, no data url, no byte array", async () => {
    const run = await runImport(await deps(), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    const serialised = JSON.stringify(run.proposal);
    expect(serialised).not.toContain("data:image");
    expect(serialised).not.toMatch(/"[A-Za-z0-9+/]{64,}={0,2}"/);
    expect(JSON.parse(serialised)).toEqual(run.proposal);
  });

  it("holds only numbers, colours, words and the brand's own addresses", async () => {
    const run = await runImport(await deps(), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    const addresses = JSON.stringify(run.proposal).match(/https?:\/\/[^"]+/g) ?? [];
    expect(addresses.length).toBeGreaterThan(0);
    expect(addresses.every((url) => url.startsWith(SITE))).toBe(true);
  });

  it("keeps the page's words nowhere, although the stub was given them", async () => {
    const run = await runImport(await deps(), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    expect(Object.keys(run.proposal)).not.toContain("words");
    expect(JSON.stringify(run.proposal)).not.toContain("club shop");
  });
});

describe("what an accepted import would write", () => {
  const now = new Date("2026-11-02T10:00:00.000Z");
  const who = { brandId: "b1", userId: "u1" };
  const input = { url: `${SITE}/`, brandName: "Ravensmoor Athletic" };

  const everything = async () => {
    const run = await runImport(await deps(), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    return (["logo", "colour", "font", "graphic", "style"] as const).reduce((proposal, kind) => decideKind(proposal, kind, "accepted"), run.proposal);
  };

  it("asks for no upload at all while the rights box is unticked", async () => {
    const plan = planOf(await everything(), EMPTY_PROFILE, "u1", now);
    expect(plan.uploads).toEqual([]);
    expect(plan.palette?.colours.length).toBeGreaterThan(0);
  });

  it("asks for the brand's own pictures once the box is ticked, each with the tick recorded", async () => {
    const plan = planOf(tickRights(await everything(), true), EMPTY_PROFILE, "u1", now);
    expect(plan.uploads.length).toBeGreaterThan(0);
    expect(plan.uploads.every((upload) => upload.url.startsWith(SITE) && upload.rights.confirmedBy === "u1")).toBe(true);
  });

  it("writes the brand's own site as its website, and no other address anywhere", async () => {
    const plan = planOf(tickRights(await everything(), true), EMPTY_PROFILE, "u1", now);
    const stored = JSON.stringify({ profile: plan.profile, palette: plan.palette, fonts: plan.fonts });
    expect(plan.profile?.website).toBe(`${SITE}/`);
    expect((stored.match(/https?:\/\/[^"]+/g) ?? []).every((url) => url === `${SITE}/`)).toBe(true);
  });

  it("writes no markup and no picture into the brand record", async () => {
    const plan = planOf(tickRights(await everything(), true), EMPTY_PROFILE, "u1", now);
    const stored = JSON.stringify({ profile: plan.profile, palette: plan.palette, fonts: plan.fonts });
    expect(stored).not.toMatch(/<[a-z!/]/i);
    expect(stored).not.toContain("data:image");
    expect(stored).not.toMatch(/"[A-Za-z0-9+/]{64,}={0,2}"/);
  });

  it("can write only a profile, a palette, fonts and uploads: there is nothing else in the plan", async () => {
    const plan = planOf(tickRights(await everything(), true), EMPTY_PROFILE, "u1", now);
    expect(Object.keys(plan).sort()).toEqual(["fonts", "palette", "profile", "uploads"]);
  });
});
