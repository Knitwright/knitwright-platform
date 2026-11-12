import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Benchmarks (spec F-S2, decision 0084), in a browser. `AI_PROVIDER_STUB` is on here, so the extraction step is the
 * deterministic stub and no model is ever called; the stub answers with an empty card, which is what a reader should
 * see when nothing is known, so these tests are also the proof that an unknown field is shown as unknown rather than
 * filled in.
 *
 * No test here reaches the network. The one URL intake it tries is a private address, which is refused before
 * anything is fetched, and that refusal is the thing being tested.
 */

const REVIEWS = [
  "The liner rides up every time I run more than five kilometres and I have to stop and pull it down again.",
  "Good shorts but the back pocket bounces when it has a phone in it.",
  "The waistband rolls over after a wash or two.",
].join(" ");

const signedIn = async (page: Page, label: string): Promise<string> => {
  const email = await createAccount(label);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/studio$/);
  return email;
};

/** A new comparison, and the address of its own page. */
const newBenchmark = async (page: Page, title: string): Promise<void> => {
  await page.goto("/ai-studio/workflow/benchmark-products");
  await page.getByLabel("What are you comparing?").fill(title);
  await page.getByRole("button", { name: "Make the benchmark" }).click();
  await expect(page).toHaveURL(/\/studio\/benchmarks\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
};

const pasteReviews = async (page: Page): Promise<void> => {
  await page.getByRole("tab", { name: "Review text" }).click();
  await page.getByLabel("Paste the reviews").fill(REVIEWS);
  await page.getByRole("button", { name: "Read these reviews" }).click();
};

test.describe("benchmarks", () => {
  test("is not a page for somebody with no session", async ({ page }) => {
    await page.goto("/ai-studio/workflow/benchmark-products");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("makes a comparison, takes review text in, and shows a card that says what it does not know", async ({ page }) => {
    await signedIn(page, "benchmark-reviews");

    // A brand with nothing yet is told the one thing that fills the screen, not just that it is empty.
    await page.goto("/ai-studio/workflow/benchmark-products");
    await expect(page.getByText("Name what you are comparing below to make the first one")).toBeVisible();

    await newBenchmark(page, "Running shorts, 5 inch");

    // A photo card is read from the brand's own pictures, and a brand with none is told where to put one.
    await page.getByRole("tab", { name: "Your own photo" }).click();
    await expect(page.getByText("Your brand has no pictures yet", { exact: false })).toBeVisible();

    // One card is not a comparison: the screen says so rather than showing a lonely column.
    await expect(page.getByTestId("compare-refused")).toContainText("Add at least 2 cards");

    await pasteReviews(page);

    // The stub knows nothing, and the card says so on every line rather than guessing.
    await expect(page.getByText("Read by stub", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not named" }).first()).toBeVisible();

    // And the page says, in words, what is never kept and what is never carried over.
    await expect(page.getByText("only our own short summaries of the themes", { exact: false })).toBeVisible();
    await expect(page.getByText("is never a feature and is never carried onto your design", { exact: false }).first()).toBeVisible();
  });

  test("lets a person correct a card, and says afterwards that the words are their team's", async ({ page }) => {
    await signedIn(page, "benchmark-correct");
    await newBenchmark(page, "Correcting a card");
    await pasteReviews(page);

    const card = page.getByTestId(/^card-review-/).first();
    await card.getByLabel("Product").fill("Comparable short, 5 inch");
    await card.getByLabel("Price", { exact: true }).fill("45.00");
    await card.getByLabel("Currency").fill("GBP");
    await card.getByLabel("Fabric", { exact: true }).fill("88% polyester, 12% elastane");
    await card.getByLabel("Fabric weight (g/m²)").fill("140");
    await card.getByLabel("Sizes").fill("S, M, L");
    await card.getByRole("checkbox", { name: /Side split/ }).check();
    await card.getByRole("button", { name: "Confirm this card" }).click();

    await expect(page.getByText("Your team has been through this card", { exact: false }).first()).toBeVisible();
    // The value is shown with where it came from, and it never claims the page said it.
    await expect(page.getByText("corrected by your team").first()).toBeVisible();
  });

  test("compares two cards with a feature matrix, and maps features onto a base product", async ({ page }) => {
    await signedIn(page, "benchmark-compare");
    await newBenchmark(page, "Two shorts");
    await pasteReviews(page);

    const first = page.getByTestId(/^card-review-/).first();
    await first.getByLabel("Product").fill("Comparable A");
    await first.getByRole("checkbox", { name: /Side split/ }).check();
    await first.getByRole("checkbox", { name: /Drop tail/ }).check();
    await first.getByRole("button", { name: "Confirm this card" }).click();
    await expect(page.getByText("Your team has been through this card", { exact: false }).first()).toBeVisible();

    await pasteReviews(page);
    const second = page.getByTestId(/^card-review-/).nth(1);
    await second.getByLabel("Product").fill("Comparable B");
    await second.getByRole("checkbox", { name: /Drop tail/ }).check();
    await second.getByRole("button", { name: "Confirm this card" }).click();

    // Two columns, and a matrix saying how each one knows each feature.
    await expect(page.getByRole("columnheader", { name: /Comparable A/ }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Comparable B/ }).first()).toBeVisible();
    await expect(page.getByTestId("matrix-drop_tail")).toBeVisible();
    await expect(page.getByTestId("matrix-side_split")).toContainText("obs");

    // The mapping onto the worked base article: what it can make, and what it cannot, each with a rule id.
    await page.getByLabel("Map these features onto").first().selectOption("JSY-SS-01");
    await page.getByRole("button", { name: "Show the mapping" }).first().click();
    await expect(page.getByTestId("mapped-drop_tail").first()).toContainText("back_drop_tail");
    await expect(page.getByTestId("mapped-drop_tail").first()).toContainText("R-PAT-005");
    await expect(page.getByTestId("unsupported").first()).toContainText("Not available on this base");
    // Every mapped line carries the product's own "Why?" link, which reads the rule rather than quoting it here.
    await expect(page.getByRole("button", { name: "Why? Rulebook R-PAT-005" }).first()).toBeVisible();
    await expect(page.getByText("A competitor's mark is never put on your design.").first()).toBeVisible();
  });

  test("refuses an address that is not a public web page, without fetching anything", async ({ page }) => {
    await signedIn(page, "benchmark-private");
    await newBenchmark(page, "A private address");

    await page.getByLabel("The product page").fill("https://127.0.0.1/admin");
    await page.getByRole("button", { name: "Read this page" }).click();

    await expect(page.getByText("That address is not a public web page.")).toBeVisible();
  });

  test("passes axe on the comparison screen", async ({ page }) => {
    await signedIn(page, "benchmark-axe");
    await newBenchmark(page, "Accessible comparison");
    await pasteReviews(page);

    const results = await new AxeBuilder({ page }).include("main").analyze();
    expect(results.violations).toEqual([]);
  });
});

/**
 * The same two screens on a 390 by 844 phone, the size and the two rules e2e/mobile.spec.ts holds every key screen
 * to: the page never scrolls sideways, and axe finds nothing serious. A wide table scrolls inside its own box, which
 * is why the page does not, so anything wider than the phone is named in the failure rather than only counted.
 */
test.describe("benchmarks on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  /** The entrance animations finish first: text still fading in fails the contrast rule for a moment (mobile.spec.ts). */
  const settled = async (page: Page): Promise<void> => {
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
    );
  };

  /** Everything in the page wider than the phone, or reaching past its right edge, with enough of it to find. */
  const tooWide = (page: Page): Promise<string[]> =>
    page.evaluate(() => {
      const room = document.documentElement.clientWidth;
      const found: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>("main *")) {
        const box = element.getBoundingClientRect();
        if (box.width <= room + 1 && box.right <= room + 1) continue;
        const inside = element.parentElement?.closest("[class*=overflow-x-auto]");
        if (inside) continue;
        found.push(`<${element.tagName.toLowerCase()} class="${element.getAttribute("class")?.slice(0, 80) ?? ""}"> is ${Math.round(box.width)} wide, right edge ${Math.round(box.right)}`);
      }
      return found.slice(0, 8);
    });

  test("neither screen scrolls sideways, and axe finds nothing serious on either", async ({ page }) => {
    await signedIn(page, "benchmark-phone");
    await newBenchmark(page, "Shorts on a phone");
    await pasteReviews(page);

    for (const path of ["/ai-studio/workflow/benchmark-products", new URL(page.url()).pathname]) {
      await page.goto(path);
      await settled(page);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect.soft(await tooWide(page), `${path} scrolls sideways by ${sideways}px; what is too wide`).toEqual([]);
      const { violations } = await new AxeBuilder({ page }).include("main").analyze();
      const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
      const where = (entry: (typeof serious)[number]) =>
        `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} ${JSON.stringify(node.any.map((check) => check.data))}`).join("; ")})`;
      expect.soft(serious.map(where), `${path}: axe`).toEqual([]);
    }
  });
});
