// Captures every public reference screen listed in REFERENCES.md.
// Usage: node knitwright-build/references/capture-references.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "screens");

const pages = [
  ["nokto-ai-designer", "https://noktosports.com/ki-designer"],
  ["nokto-how-it-works", "https://noktosports.com/how-it-works"],
  ["nokto-team", "https://noktosports.com/team"],
  ["spized-home", "https://www.spized.com/en/"],
  ["owayo-home", "https://www.owayo.com/"],
  ["fashdeck-home", "https://www.fashdeck.com/"],
  ["blankbuilder-home", "https://blankbuilder.app/"],
  ["blankbuilder-whats-new", "https://blankbuilder.app/whats-new/"],
  ["specform-product", "https://specform.pro/product"],
  ["fabra-pattern-editing", "https://www.fabra.com/features/pattern-editing"],
  ["fabra-pricing", "https://www.fabra.com/pricing"],
  ["printify-pricing", "https://printify.com/pricing/"],
  ["printify-integrations", "https://printify.com/integrations/"],
  ["printify-jerseys", "https://printify.com/custom-jerseys/"],
  ["fash-studio-home", "https://fash.studio/"],
  ["mercer-pricing", "https://www.mercer.design/pricing"],
];

// Decline-only cookie buttons; we never accept optional cookies.
const declineLabels = [/necessary only/i, /reject all/i, /decline/i, /only essential/i, /ablehnen/i];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const [id, url] of pages) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    for (const label of declineLabels) {
      const button = page.getByRole("button", { name: label }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click().catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: join(outDir, `${id}.png`), fullPage: true });
    console.log(`saved ${id}`);
  } catch (err) {
    console.warn(`failed ${id}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
