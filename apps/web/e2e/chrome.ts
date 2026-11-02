import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helpers for the shared chrome every signed-in page carries: the studio top bar and the
 * accessibility scan of the page under it (decision 0103).
 *
 * They were written in `e2e/brand-studio.spec.ts`, where the top bar's first guard went, and sit
 * here rather than in `e2e/support.ts` because five specs want them at once and that file is
 * already the longest in the folder.
 */

/**
 * No axe problem of impact serious or critical, and the node and the figures it failed on when
 * there is one, so a fault names the element and its colours rather than only its rule.
 *
 * The scan waits for the entrance animations first: the drifting aurora never stops, so only the
 * animations that end are waited for, and text still fading in fails the contrast rule for a
 * moment.
 */
/**
 * Waits for the entrance animations to end, so a measurement is of the settled page.
 *
 * `globals.css`'s `kw-rise` runs for 900 ms and starts at `translateY(18px) scale(0.985)`, so
 * anything measured while it plays is up to 1.5% small and up to 18 px high: a 40 px tap target
 * measures 39.4, which rounds to 39 and fails a 40 px floor. That is how
 * `studio-chrome.spec.ts`'s "the way home is this wide" failed on a loaded runner while passing
 * everywhere else -- the assertion was right and the moment was wrong.
 *
 * The drifting aurora never ends, so only the animations that finish are waited for. Text still
 * fading in also fails the contrast rule for a moment, which is why `accessible` waits too.
 */
export const settled = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
};

export const accessible = async (page: Page): Promise<void> => {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  const where = (node: (typeof serious)[number]["nodes"][number]): string =>
    `${node.target.join(" ")} ${JSON.stringify(node.any.map((check) => check.data))}`;
  expect(serious.map((entry) => `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map(where).join("; ")})`)).toEqual([]);
};

/** A control's own side padding: anything up to this still keeps its words on the glass. */
const CONTROL_PADDING = 12;

/**
 * Nothing in the top bar hangs outside its glass pill. What overflows is drawn over the aurora
 * instead, where `text-muted` is 3.35:1 and fails the accessibility scan of every studio page.
 * The last control of the row is the first to go, whichever control that is at this width.
 */
export const headerFits = async (page: Page, where = ""): Promise<void> => {
  // Settled first, or the entrance's inward scale pulls the last control back inside the glass and
  // a real spill measures as none: this guard was weaker than it read while the animation played.
  await settled(page);
  const measured = await page.evaluate(() => {
    const bar = document.querySelector("header");
    if (bar === null) return null;
    const shown = (element: Element): boolean => {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };
    const controls = [...bar.querySelectorAll("a[href], button, summary")].filter(shown);
    const last = controls.at(-1);
    if (last === undefined) return null;
    return {
      spill: Math.round(last.getBoundingClientRect().right - bar.getBoundingClientRect().right),
      last: (last.textContent ?? "").trim().slice(0, 40),
    };
  });
  expect(measured, `the top bar has no controls to measure ${where}`).not.toBeNull();
  expect(
    measured?.spill ?? 0,
    `the top bar's last control ("${measured?.last}") hangs outside the glass pill ${where} by this many pixels`,
  ).toBeLessThanOrEqual(CONTROL_PADDING);
};

/**
 * The widths the bar supports: a phone; the band nothing had ever measured, where the bar before
 * decision 0103 ran 374 px past its glass at 768 and 118 px at 1024; the browser tests' own
 * desktop; and a wide screen, where the bar is no wider at all, because it is capped at the page
 * width.
 */
export const BAR_WIDTHS = [390, 768, 1024, 1280, 1440] as const;

/** The bar keeps its words on the glass at every width it supports. Leaves the viewport as it was. */
export const headerFitsAtEveryWidth = async (page: Page): Promise<void> => {
  const was = page.viewportSize();
  for (const width of BAR_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await headerFits(page, `at ${width} px`);
  }
  if (was !== null) await page.setViewportSize(was);
};

/**
 * Opens the top bar's menu holding the address signed in, Settings and Sign out. Below 1024 px
 * that is the one `Menu` the bar has always had on a phone; above it, the `Account` menu.
 */
export const openAccountMenu = async (page: Page): Promise<Locator> => {
  const button = page.locator("header").getByRole("button", { name: /^(Account|Menu)$/ });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  return button;
};

/**
 * Opens a studio section from the top bar, through the overflow menu when the section is one of
 * those listed there rather than one of the four pills.
 */
export const openStudioSection = async (page: Page, label: string): Promise<void> => {
  const bar = page.locator("header");
  const pill = bar.getByRole("link", { name: label, exact: true });
  if ((await pill.count()) === 0) await bar.getByRole("button", { name: /^(More|Menu)\b/ }).click();
  await bar.getByRole("link", { name: label, exact: true }).click();
};
