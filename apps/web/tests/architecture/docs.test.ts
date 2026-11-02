import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The documents that point at the repository must point at things that are in it.
 *
 * The launch checklist spent three weeks naming `docs/owner/open-decisions-2026-10-15.md`, a file that
 * has never existed on any branch, and sending its reader to look for it. Its own preamble admitted it
 * was weaker than its sources. A reader who follows a path and finds nothing stops trusting the whole
 * document, so a dead path is worse than a missing paragraph.
 *
 * This reads every markdown link and every backticked repository path out of the documents a reader is
 * sent to first, and fails on one that does not resolve. It is deliberately narrow: it checks the
 * documents R4 owns plus the two the README sends every newcomer to, not all of `docs/`, because a
 * spec or a decision record may name a path that is deliberately not in the repository and says so.
 *
 * It also checks that every decision record is reachable: the index is generated, and a record nobody
 * links is a record nobody reads (decision 0080 was written, merged and never indexed at all).
 */

const REPO = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

/** The documents a reader arrives at first, and so the ones whose paths must all resolve. */
const CHECKED = [
  "README.md",
  "docs/architecture.md",
  "docs/launch-checklist.md",
  "docs/owner/README.md",
  "docs/owner/open-questions-v5.md",
] as const;

/** A markdown link's target: `[words](target)`. Anchors, mailto and absolute URLs are not paths. */
const LINKS = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** A backticked token that looks like a repository path: has a slash and a file extension, or ends in a slash. */
const BACKTICKED = /`([^`\s]+)`/g;
const LOOKS_LIKE_A_PATH = /^(?:apps|docs|plans|scripts|supabase|\.github)\/[\w./[\]()@-]*$/;

/**
 * Paths a document names **in order to say they are not here**. Each one needs a reason, and nothing
 * may be added without one: the point of this test is that a reader can follow any other path.
 */
const NEVER_EXISTED: Readonly<Record<string, string>> = {
  // Named by the questionnaire of 2026-10-25 for items P1 to P17 and A5, and by the launch checklist,
  // which now says plainly that no commit on any branch has ever held it, and where those items
  // really are: plans/production-outputs.md section 7, and docs/owner/size-charts.md.
  "docs/owner/open-decisions-2026-10-15.md": "never existed; the checklist and the question list both say so and say where its content is",
};

const read = (relativePath: string): string => readFileSync(join(REPO, relativePath), "utf8");

/** Every link target in one document that is a path into this repository, resolved against it. */
function linkedPaths(document: string): { readonly written: string; readonly resolved: string }[] {
  const body = read(document);
  const base = dirname(join(REPO, document));
  const out: { written: string; resolved: string }[] = [];
  for (const [, target] of body.matchAll(LINKS)) {
    if (!target || /^(?:[a-z]+:|#)/.test(target)) continue;
    const [withoutAnchor] = target.split("#");
    if (!withoutAnchor) continue;
    out.push({ written: target, resolved: resolve(base, withoutAnchor) });
  }
  return out;
}

/** Every backticked repository path in one document, resolved against the repository root. */
function quotedPaths(document: string): { readonly written: string; readonly resolved: string }[] {
  const out: { written: string; resolved: string }[] = [];
  for (const [, token] of read(document).matchAll(BACKTICKED)) {
    // A glob or a brace stands for a set of files, not one file.
    if (!token || token.includes("*") || token.includes("<") || !LOOKS_LIKE_A_PATH.test(token)) continue;
    if (!/\.[a-z]+$/.test(token) && !token.endsWith("/")) continue;
    if (token in NEVER_EXISTED) continue;
    out.push({ written: token, resolved: join(REPO, token) });
  }
  return out;
}

describe.each(CHECKED)("%s", (document) => {
  it("links only to files that exist", () => {
    const dead = linkedPaths(document).filter((path) => !existsSync(path.resolved));
    expect(dead.map((path) => path.written), `${document} links to a path that is not in the repository`).toStrictEqual([]);
  });

  it("names only repository paths that exist", () => {
    const dead = quotedPaths(document).filter((path) => !existsSync(path.resolved));
    expect(dead.map((path) => path.written), `${document} names a repository path that does not exist`).toStrictEqual([]);
  });
});

describe("the one path that is named in order to be denied", () => {
  it("is still absent, and the checklist still explains it", () => {
    for (const path of Object.keys(NEVER_EXISTED)) {
      // If it ever does arrive, drop it from NEVER_EXISTED and from the checklist's explanation.
      expect(existsSync(join(REPO, path)), `${path} exists now: ${NEVER_EXISTED[path]}`).toBe(false);
    }
    const checklist = read("docs/launch-checklist.md");
    expect(checklist).toContain("no commit on any branch has ever held a file of that name");
    expect(checklist).toContain("plans/production-outputs.md");
    expect(checklist).toContain("docs/owner/size-charts.md");
  });
});

describe("the decision records", () => {
  const records = (): readonly string[] =>
    readdirSync(join(REPO, "docs/decisions"))
      .filter((file) => /^\d{4}-.*\.md$/.test(file) && !file.startsWith("0000-"))
      .sort();

  it("are every one of them linked from the generated index", () => {
    const index = read("docs/decisions/README.md");
    const missing = records().filter((file) => !index.includes(file));
    expect(missing, "a record the index does not link. Run: node scripts/write-decision-index.mjs").toStrictEqual([]);
  });

  it("each state a status, so the checklist can say how many are still only proposed", () => {
    const withoutStatus = records().filter((file) => !/^Status:/m.test(read(join("docs/decisions", file))));
    expect(withoutStatus).toStrictEqual([]);
  });
});
