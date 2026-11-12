import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/lib/server/public-pages";
import { devRoutesEnabled } from "./dev-routes";

describe("the /dev fixture pages", () => {
  it("are open in development and in tests", () => {
    expect(devRoutesEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(devRoutesEnabled({})).toBe(true);
  });

  it("answer 404 in production unless DEV_UI_ROUTES is exactly on", () => {
    expect(devRoutesEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(devRoutesEnabled({ NODE_ENV: "production", DEV_UI_ROUTES: "true" })).toBe(false);
    expect(devRoutesEnabled({ NODE_ENV: "production", DEV_UI_ROUTES: "off" })).toBe(false);
    expect(devRoutesEnabled({ NODE_ENV: "production", DEV_UI_ROUTES: "on" })).toBe(true);
  });

  it("are listed as public pages, and the switch is documented in .env.example", () => {
    expect(PUBLIC_PAGES).toContain("app/dev/ui/page.tsx");
    const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
    expect(example).toMatch(/^# DEV_UI_ROUTES=on$/m);
  });
});
