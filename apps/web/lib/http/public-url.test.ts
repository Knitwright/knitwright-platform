import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fetchProductPage } from "@/lib/benchmarks/fetch";
import { ownUrl } from "@/lib/brand-studio/import/fetch";
import { isPrivateHost, PRIVATE_HOST } from "./public-url";

const WEB = fileURLToPath(new URL("../../", import.meta.url));

/** Addresses this server will not fetch, and the reason each one is on the list. */
const PRIVATE = [
  ["localhost", "localhost"],
  ["the loopback address", "127.0.0.1"],
  ["another address in 127/8", "127.1.2.3"],
  ["the unspecified address", "0.0.0.0"],
  ["IPv6 loopback", "::1"],
  ["IPv6 loopback in brackets", "[::1]"],
  ["a private 10/8 address", "10.0.0.5"],
  ["a private 192.168/16 address", "192.168.0.4"],
  ["the bottom of 172.16/12", "172.16.0.1"],
  ["the top of 172.16/12", "172.31.255.254"],
  ["the cloud metadata address", "169.254.169.254"],
  ["a name on the local network", "printer.local"],
  ["a name inside a cloud network", "metadata.google.internal"],
  ["a name under .localhost", "api.localhost"],
  ["the same in capitals", "PRINTER.LOCAL"],
] as const;

/** Addresses that are public, including the ones that look private and are not. */
const PUBLIC = [
  ["a shop", "knitwright.com"],
  ["a subdomain", "shop.example.co.uk"],
  ["just outside 172.16/12 below", "172.15.0.1"],
  ["just outside 172.16/12 above", "172.32.0.1"],
  ["a public 11/8 address", "11.0.0.1"],
  ["a name that only ends in local", "mylocal.com"],
  ["a name holding the word internal", "internal-news.example.com"],
] as const;

describe("the one list of addresses that are not a public web page", () => {
  it.each(PRIVATE)("refuses %s", (_why, hostname) => {
    expect(isPrivateHost(hostname)).toBe(true);
  });

  it.each(PUBLIC)("allows %s", (_why, hostname) => {
    expect(isPrivateHost(hostname)).toBe(false);
  });

  it("is not rewritten by a test of its own", () => {
    expect(PRIVATE_HOST.flags).toContain("i");
  });
});

/**
 * The point of moving the list: Z3's benchmark fetch and L7's brand import each had one, written
 * out twice, and only the second author knew. This fails the moment a third copy appears, or either
 * of the two goes back to a list of its own.
 */
describe("the files that fetch an address a person typed", () => {
  const sources = (dir: string): string[] =>
    readdirSync(join(WEB, dir), { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name));

  it("hold no private-address list of their own: there is one, and it is lib/http/public-url.ts", () => {
    const carriers = ["lib", "app", "components"]
      .flatMap(sources)
      .filter((path) => /169\.254|192\.168\.\\d|\[\?::1\\\]\?/.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(WEB.length));
    expect(carriers).toEqual(["lib/http/public-url.ts"]);
  });
});

describe("both polite fetchers", () => {
  const never = (): never => {
    throw new Error("nothing may be fetched for a private address");
  };

  it.each(PRIVATE.filter(([, hostname]) => !hostname.startsWith("[")))("refuse https://%s/ without reaching the network — %s", async (_why, hostname) => {
    const bracketed = hostname.includes(":") ? `[${hostname}]` : hostname;
    const benchmark = await fetchProductPage(never, `https://${bracketed}/kit`);
    expect(benchmark.ok).toBe(false);
    expect(benchmark.ok === false && benchmark.reason).toBe("private_host");

    const brand = ownUrl(`https://${bracketed}/`);
    expect(brand.ok).toBe(false);
    expect(brand.ok === false && brand.refusal.reason).toBe("private_host");
  });

  it("still read a public address", async () => {
    expect(ownUrl("https://knitwright.com/").ok).toBe(true);
  });
});
