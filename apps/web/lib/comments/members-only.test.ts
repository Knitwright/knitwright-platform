import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = join(__dirname, "..", "..");

/** Every source file under a folder of the app, as text. */
const sources = (dir: string): readonly { file: string; text: string }[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [{ file: path, text: readFileSync(path, "utf8") }] : [];
  });

describe("comments are for members only (decision 0063)", () => {
  /**
   * The one thing a public page may take from the comments code is `lib/comments/text.ts`: the
   * cleaner that turns typed words into words we will keep. A committee pin IS a design comment in
   * shape (plan v5 Z7, decision 0086), so it is cleaned by that one cleaner rather than a second
   * one of its own. The test below proves that module holds no import at all, so it can never grow
   * a database read and sneak one onto a public page through this allowance.
   */
  const TEXT_CLEANER = "lib/comments/text";

  it("nothing that serves a share link reads or names comments, beyond the pure text cleaner", () => {
    const shared = [
      ...sources(join(WEB, "lib", "share")),
      ...sources(join(WEB, "app", "s")),
      ...sources(join(WEB, "components", "share")),
      ...sources(join(WEB, "components", "committee")),
    ];
    expect(shared.length).toBeGreaterThan(0);
    for (const { file, text } of shared) {
      expect(text, file).not.toMatch(/design_comment|components\/comments/);
      expect(text.split(TEXT_CLEANER).join(" "), file).not.toMatch(/lib\/comments/);
    }
  });

  it("the text cleaner a public page may use imports nothing, so it can never read a comment", () => {
    const cleaner = readFileSync(join(WEB, "lib", "comments", "text.ts"), "utf8");

    expect(cleaner).not.toMatch(/^\s*import\b/m);
    expect(cleaner).not.toMatch(/design_comment|supabase|SupabaseClient/);
  });

  it("every comments route asks for a signed-in member", () => {
    const routes = sources(join(WEB, "app", "api", "projects", "[projectId]", "comments")).filter((s) => s.file.endsWith("route.ts"));
    expect(routes).toHaveLength(3);
    for (const { file, text } of routes) {
      expect(text, file).toContain('auth: "member"');
      expect(text, file).not.toContain('auth: "public"');
    }
  });

  it("the browser never sends who wrote a comment or which brand it is in", () => {
    const schema = readFileSync(join(WEB, "lib", "comments", "schemas.ts"), "utf8");
    expect(schema).not.toMatch(/brandId|authorId|userId/);
  });
});
