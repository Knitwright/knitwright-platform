import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { seedTemplates } from "../lib/templates/seed/seed";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Decision 0064: the key screens on a 390 by 844 phone. Each has no sideways scroll, no tap target under
 * 40 px, and no axe problem of impact serious or critical. A failure lists every problem of the page at once.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

test.beforeAll(async () => {
  await seedTemplates(serviceClient());
});

const MIN_TARGET = 40;

/** The entrance animations finish first: text that is still fading in fails the contrast rule for a moment. */
const settled = async (page: Page): Promise<void> => {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
};

/** Controls a thumb has to hit that are smaller than MIN_TARGET either way. Links inside running text are exempt. */
const smallTargets = (page: Page): Promise<string[]> =>
  page.evaluate((min) => {
    const found: string[] = [];
    const selector = 'a[href], button, summary, select, textarea, input:not([type="hidden"]), [role="tab"], [role="button"]';
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || element.closest("[hidden], [inert]")) continue;
      // The content of a closed disclosure (the phone menu) cannot be touched; its summary can.
      const closed = element.closest("details:not([open])");
      if (closed && !element.matches("summary") ) continue;
      // A link whose ::after covers its card is touched anywhere on the card.
      const after = getComputedStyle(element, "::after");
      if (element instanceof HTMLAnchorElement && after.position === "absolute" && after.content !== "none") continue;
      const isCheck = element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio");
      const box = (isCheck ? element.closest("label") ?? element : element).getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Skip links (skip-to-content) that sit off screen until focused.
      if (box.right <= 0 || box.bottom <= 0) continue;
      if (element instanceof HTMLAnchorElement) {
        const block = element.closest("p, li, dd, td, span.prose");
        const around = block?.textContent?.trim().length ?? 0;
        const own = element.textContent?.trim().length ?? 0;
        if (block && block !== element && around > own + 8 && getComputedStyle(element).display === "inline") continue;
      }
      if (box.width < min || box.height < min) {
        const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40);
        const where = (isCheck ? element.closest("label") ?? element : element).outerHTML.replace(/\s+/g, " ").slice(0, 110);
        found.push(`${element.tagName.toLowerCase()} "${name}" is ${Math.round(box.width)} by ${Math.round(box.height)}: ${where}`);
      }
    }
    return found;
  }, MIN_TARGET);

const checkPage = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await settled(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `${path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
  expect.soft(await smallTargets(page), `${path}: tap targets under ${MIN_TARGET}px`).toEqual([]);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect.soft(serious.map((entry) => `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map((node) => node.target.join(" ")).join("; ")})`), `${path}: axe`).toEqual([]);
};

const startDesign = async (page: Page): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Phone tee");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Phone tee" })).toBeVisible();
  return new URL(page.url()).pathname;
};

test.describe("the key screens on a phone", () => {
  test("studio home, a design, its factory file, templates, club and credits", async ({ page }) => {
    await signIn(page, await createAccount("phone"));
    await expect(page).toHaveURL(/\/studio$/);
    await checkPage(page, "/studio");
    const design = await startDesign(page);
    await checkPage(page, design);
    await checkPage(page, `${design}/tech-pack`);
    await checkPage(page, "/templates");
    await checkPage(page, "/club");
    await checkPage(page, "/credits");
  });

  test("ops, for a platform admin", async ({ page }) => {
    const email = await createAccount("phone-ops");
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await checkPage(page, "/ops");
  });
});
