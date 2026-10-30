import { describe, expect, it } from "vitest";
import { ALL_ALLOWED, parseRobots, pathAllowed, robotsAllows } from "./robots";
import { BENCHMARK_ROBOTS_NAME } from "./vocabulary";

/** robots.txt, honoured (spec F-S2 step 2). The rules are RFC 9309's: longest match wins, a tie goes to Allow. */

const file = [
  "# a shop's robots.txt",
  "User-agent: *",
  "Disallow: /checkout",
  "Disallow: /search",
  "",
  "User-agent: KnitwrightBenchmark",
  "User-agent: SomeoneElse",
  "Disallow: /",
  "Allow: /products/",
  "Allow: /products/*/reviews$",
].join("\n");

describe("reading the file", () => {
  it("takes our own group when the file names us, and not the star group", () => {
    const rules = parseRobots(file);
    expect(rules.matchedAgent).toBe(BENCHMARK_ROBOTS_NAME);
    expect(rules.disallow).toEqual(["/"]);
    expect(rules.allow).toEqual(["/products/", "/products/*/reviews$"]);
  });

  it("falls back to the star group for an agent the file does not name", () => {
    const rules = parseRobots(file, "somebodyelse");
    expect(rules.matchedAgent).toBe("*");
    expect(rules.disallow).toEqual(["/checkout", "/search"]);
  });

  it("treats a file that names nobody, and an empty Disallow, as allowing everything", () => {
    expect(parseRobots("")).toEqual(ALL_ALLOWED);
    expect(parseRobots("User-agent: *\nDisallow:")).toEqual({ matchedAgent: "*", allow: [], disallow: [] });
    expect(parseRobots("Sitemap: https://example.test/sitemap.xml")).toEqual(ALL_ALLOWED);
  });

  it("starts a new group at the next user-agent line after a rule", () => {
    const two = "User-agent: *\nDisallow: /a\nUser-agent: knitwrightbenchmark\nDisallow: /b";
    expect(parseRobots(two).disallow).toEqual(["/b"]);
    expect(parseRobots(two, "other").disallow).toEqual(["/a"]);
  });
});

describe("deciding one path", () => {
  const rules = parseRobots(file);

  it("lets the product pages through and keeps us out of everything else", () => {
    expect(pathAllowed(rules, "/products/speedshort")).toBe(true);
    expect(pathAllowed(rules, "/basket")).toBe(false);
    expect(pathAllowed(rules, "/")).toBe(false);
  });

  it("reads * and $ as the standard does", () => {
    expect(pathAllowed(rules, "/products/x/reviews")).toBe(true);
    expect(pathAllowed(parseRobots("User-agent: *\nDisallow: /*.pdf$"), "/sheets/care.pdf")).toBe(false);
    expect(pathAllowed(parseRobots("User-agent: *\nDisallow: /*.pdf$"), "/sheets/care.pdf?x=1")).toBe(true);
  });

  it("gives a tie to Allow", () => {
    const tie = parseRobots("User-agent: *\nDisallow: /p\nAllow: /p");
    expect(pathAllowed(tie, "/p")).toBe(true);
  });

  it("treats an empty path as the home page", () => {
    expect(pathAllowed(parseRobots("User-agent: *\nDisallow: /"), "")).toBe(false);
  });
});

describe("one whole URL", () => {
  it("answers for the URL's path and query, and allows everything when there is no file", () => {
    expect(robotsAllows(file, "https://shop.test/products/speedshort?size=m")).toBe(true);
    expect(robotsAllows(file, "https://shop.test/checkout")).toBe(false);
    expect(robotsAllows(null, "https://shop.test/checkout")).toBe(true);
  });
});
