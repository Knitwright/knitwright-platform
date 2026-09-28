import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { expect, test } from "@playwright/test";
import { PUBLIC_ENTRY_POINTS } from "../lib/server/public-routes";

/**
 * Step 2 acceptance: a request with no session is refused by every route that is not
 * on the allow list. Routes are found on disk, so a new one is covered without anyone
 * remembering to add it here.
 */

const APP_DIR = join(__dirname, "..", "app");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type Endpoint = Readonly<{ entry: string; method: string; path: string }>;

/** "app/api/designs/[id]/route.ts" becomes "/api/designs/placeholder". */
const urlPathOf = (file: string): string =>
  `/${file
    .split("/")
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => (/^\[.*\]$/.test(segment) ? "placeholder" : segment))
    .join("/")}`;

const endpoints = (): Endpoint[] =>
  readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
    .map((name) => name.split(sep).join("/"))
    .filter((name) => /(^|\/)route\.tsx?$/.test(name))
    .flatMap((name) => {
      const text = readFileSync(join(APP_DIR, name), "utf8");
      return METHODS.filter((method) =>
        new RegExp(`export\\s+const\\s+${method}\\b`).test(text),
      ).map((method) => ({ entry: `app/${name}#${method}`, method, path: urlPathOf(name) }));
    });

const allowed = new Set<string>(PUBLIC_ENTRY_POINTS);
const guarded = endpoints().filter((endpoint) => !allowed.has(endpoint.entry));

test("there are guarded routes to check", () => {
  expect(guarded.length).toBeGreaterThan(0);
});

for (const endpoint of guarded) {
  test(`${endpoint.method} ${endpoint.path} refuses a request with no session`, async ({
    request,
  }) => {
    const response = await request.fetch(endpoint.path, {
      method: endpoint.method,
      data: endpoint.method === "GET" ? undefined : {},
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "unauthenticated" },
    });
  });
}

test("a page that needs a session sends a visitor to sign-in", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a session cookie that was made up is not accepted", async ({ page, context, baseURL }) => {
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify({ access_token: "made.up.token", refresh_token: "x" })).toString("base64")}`,
      url: baseURL,
    },
  ]);

  const response = await page.request.get("/api/me");
  expect(response.status()).toBe(401);

  await page.goto("/studio");
  await expect(page).toHaveURL(/\/sign-in$/);
});
