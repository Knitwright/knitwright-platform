import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helpers for the shared chrome every signed-in page carries: the dashboard shell (the rail, the
 * top bar and its menus, decision 0138) and the accessibility scan of the page inside it.
 *
 * They sit here rather than in `e2e/support.ts` because many specs want them at once and that file
 * is already the longest in the folder.
 */

/**
 * Waits for the entrance animations to end, so a measurement is of the settled page.
 *
 * `globals.css`'s `kw-rise` runs for 900 ms and starts at `translateY(18px) scale(0.985)`, so
 * anything measured while it plays is up to 1.5% small and up to 18 px high: a 40 px tap target
 * measures 39.4, which rounds to 39 and fails a 40 px floor. That is how the v2.2 top bar's "the way
 * home is this wide" failed on a loaded runner while passing everywhere else -- the assertion was
 * right and the moment was wrong.
 *
 * Only the animations that finish are waited for. Text still fading in also fails the contrast rule
 * for a moment, which is why `accessible` waits too.
 */
export const settled = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
};

/**
 * No axe problem of impact serious or critical, and the node and the figures it failed on when
 * there is one, so a fault names the element and its colours rather than only its rule. It waits
 * for the page to settle first, because text still fading in fails the contrast rule for a moment.
 *
 * `within` narrows the scan to one part of the page, for a panel on a screen the whole suite does
 * not yet scan: a new panel is then held to the bar without its test standing or falling on
 * everything else that screen already draws.
 */
export const accessible = async (page: Page, within?: string): Promise<void> => {
  await settled(page);
  const builder = new AxeBuilder({ page });
  const { violations } = await (within === undefined ? builder : builder.include(within)).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  const where = (node: (typeof serious)[number]["nodes"][number]): string =>
    `${node.target.join(" ")} ${JSON.stringify(node.any.map((check) => check.data))}`;
  expect(serious.map((entry) => `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map(where).join("; ")})`)).toEqual([]);
};

/**
 * The widths the shell supports: a phone, where the rail is hidden and the top bar starts with its
 * Menu; a tablet; 10 §4's 1024 px floor for the dashboard; the browser tests' own desktop; and the
 * 1440 px of the reference images.
 */
export const SHELL_WIDTHS = [390, 768, 1024, 1280, 1440] as const;

/**
 * The page does not scroll sideways and nothing in the top bar runs past the window's right edge.
 * The v2.2 bar overflowed its glass at 768 and 1024 for months because nothing measured it there
 * (decision 0103); the shell is measured at every width it supports (decision 0138).
 */
export const shellFits = async (page: Page, where = ""): Promise<void> => {
  await settled(page);
  const measured = await page.evaluate(() => {
    const bar = document.querySelector("header");
    const width = document.documentElement.clientWidth;
    const controls = bar ? [...bar.querySelectorAll("a[href], button")] : [];
    const right = Math.max(0, ...controls.map((element) => element.getBoundingClientRect().right));
    return { sideways: document.documentElement.scrollWidth - width, spill: Math.round(right - width) };
  });
  expect(measured.sideways, `the page scrolls sideways ${where} by this many pixels`).toBeLessThanOrEqual(0);
  expect(measured.spill, `the top bar runs past the window ${where} by this many pixels`).toBeLessThanOrEqual(0);
};

/** The shell fits at every width it supports. Leaves the viewport as it was. */
export const shellFitsAtEveryWidth = async (page: Page): Promise<void> => {
  const was = page.viewportSize();
  for (const width of SHELL_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await shellFits(page, `at ${width} px`);
  }
  if (was !== null) await page.setViewportSize(was);
};

/** Opens the top bar's avatar menu: the address signed in, Settings and Sign out (decisions 0103, 0138). */
export const openAccountMenu = async (page: Page): Promise<Locator> => {
  const button = page.locator("header").getByRole("button", { name: "Account", exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  return button;
};

/** Sign out, from the avatar menu. */
export const signOutFromShell = async (page: Page): Promise<void> => {
  await openAccountMenu(page);
  await page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name: "Sign out" }).click();
};

/** The rail. Hidden below 768 px, where the top bar's Menu holds the same places. */
export const rail = (page: Page): Locator => page.getByRole("navigation", { name: "Main" });

/**
 * Opens a place from the shell the way a person would (decision 0138): a rail item; Orders, Store
 * and Team behind ⌄; the v2.2 pages with no rail item in ⋯; and on a phone, the top bar's Menu.
 */
export const openShellPlace = async (page: Page, label: string): Promise<void> => {
  const nav = rail(page);
  if (!(await nav.isVisible())) {
    await page.locator("header").getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menu", { name: "Menu" }).getByRole("menuitem", { name: label, exact: true }).click();
    return;
  }
  const link = nav.getByRole("link", { name: label, exact: true });
  if (await link.isVisible()) return link.click();
  const group = nav.getByRole("button", { name: "Orders, Store and more" });
  if (await group.isVisible()) {
    await group.click();
    if (await link.isVisible()) return link.click();
  }
  await nav.getByRole("button", { name: /^More\b/ }).click();
  await page.getByRole("menu", { name: "More places" }).getByRole("menuitem", { name: label, exact: true }).click();
};
