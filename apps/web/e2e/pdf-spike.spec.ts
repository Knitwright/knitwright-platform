import { expect } from "@playwright/test";
import { readPdf } from "../lib/flat/fixtures/pdf-read";
import { createAccount, signIn, test } from "./support";

/** The spike of plan step 7, run against the built app. See docs/decisions/0008. */
test("the built app draws a flat as a PDF inside a route handler", async ({ page }) => {
  await signIn(page, await createAccount("pdf-spike"));
  await expect(page).toHaveURL(/\/studio$/);

  const started = Date.now();
  const response = await page.request.get("/api/flat-spike");
  const elapsed = Date.now() - started;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");

  const body = await response.body();
  const facts = await readPdf(new Uint8Array(body));
  expect(facts.startsAsPdf).toBe(true);
  expect(facts.widthPoints).toBeCloseTo(595.28, 1);
  expect(facts.heightPoints).toBeCloseTo(841.89, 1);
  expect(facts.text).toContain("Callout: chest width 52.0 cm");
  test.info().annotations.push({
    type: "evidence",
    description: `bytes=${body.byteLength} roundTripMs=${elapsed} renderMs=${response.headers()["x-render-milliseconds"]} heapMb=${response.headers()["x-heap-used-mb"]} rssMb=${response.headers()["x-rss-mb"]}`,
  });
});
