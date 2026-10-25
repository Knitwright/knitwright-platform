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
  it("nothing that serves a share link reads or names comments", () => {
    const shared = [...sources(join(WEB, "lib", "share")), ...sources(join(WEB, "app", "s")), ...sources(join(WEB, "components", "share"))];
    expect(shared.length).toBeGreaterThan(0);
    for (const { file, text } of shared) {
      expect(text, file).not.toMatch(/design_comment|lib\/comments|components\/comments/);
    }
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
