import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { ROUTE_ALIASES } from "../shell/redirects";
import { PRODUCTS_MOVED } from "./redirects";

/** Plan v6 P4 (decision 0142): the catalogue and the fabric library moved under /products, with 308s behind them. */

const APP = new URL("../../app/(app)/", import.meta.url);

const pageAt = (address: string): boolean => {
  const folder = address.replace(/^\//, "").replace(/:code/, "[slug]");
  return [`${folder}/page.tsx`, `${folder}/(home)/page.tsx`].some((file) => existsSync(new URL(file, APP)));
};

describe("the moved pages", () => {
  it("are permanent, from an address with no page left to one with a page", () => {
    for (const moved of PRODUCTS_MOVED) {
      expect(moved.permanent).toBe(true);
      expect(pageAt(moved.source), moved.source).toBe(false);
      expect(pageAt(moved.destination), moved.destination).toBe(true);
    }
  });

  it("sends the old Templates tab to the template library, before the catalogue's own rule", () => {
    expect(PRODUCTS_MOVED[0]).toMatchObject({ source: "/catalogue", destination: "/templates", has: [{ type: "query", key: "tab", value: "templates" }] });
    expect(PRODUCTS_MOVED[1]).toMatchObject({ source: "/catalogue", destination: "/products" });
  });

  it("are the first rules next.config answers with, and no temporary alias points at /products any more", async () => {
    const rules = await nextConfig.redirects!();
    expect(rules.slice(0, PRODUCTS_MOVED.length).map((rule) => rule.source)).toEqual(PRODUCTS_MOVED.map((moved) => moved.source));
    expect(rules[1]).not.toHaveProperty("has");
    expect(ROUTE_ALIASES.some((alias) => alias.source.startsWith("/products") || alias.destination.startsWith("/catalogue"))).toBe(false);
  });
});
