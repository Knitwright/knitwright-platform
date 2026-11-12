import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { allowClassBRun, createAccount, makePlatformAdmin, passBotCheck, signIn, standInForBotCheck, summary, test, userIdOf } from "./support";

/**
 * THE THREE JOURNEYS OF PLAN v5 WAVE 5 (R3), ON REAL SCREENS.
 *
 * `e2e/journeys.spec.ts` holds v4's three role journeys. These are the three the v5 plan names as
 * the acceptance criteria of the whole plan: the founder from a base article to a golden sample to
 * a run hand-off; the club from crest-to-kit to committee approval to the roster to the hand-off;
 * ops from a batch to the job packet to QC to the shipment.
 *
 * **Where a journey stops, the stop is the assertion.** Three walls are known and deliberate, and
 * each one is asserted here in the platform's own words rather than stepped around with a fixture:
 *
 *   1. **No care label prints in any market** (ISO 3758 is a paid standard and is not in the
 *      repository, decision 0089), so the production package refuses every order. The founder
 *      journey asserts that refusal, which is where its hand-off really ends.
 *   2. **No delivery date exists anywhere**: `qcDays` and `freightDays` are both unset, so
 *      `lib/factory/dates.ts` answers "not set" and no screen invents one. All three journeys
 *      assert the absence on the screen they reach it on.
 *   3. **Seven of the eight base articles publish no measurement at all** (decision 0090), so the
 *      founder journey's own base article says so on its size chart.
 *
 * Two more walls were found by walking these screens and are asserted here too, because a wall that
 * is only written down in a review is a wall the next change can move without noticing:
 *
 *   4. The **committee lock** needs a version checked against a factory profile, and the design
 *      validation screen cannot record one until a fabric test exists. The approval is recorded;
 *      the lock is refused, in words.
 *   5. The **commercial invoice** needs the order's factory to be a row in `factories`, and only
 *      `sialkot-partner` is seeded, so an order placed by the Store cannot be invoiced.
 *
 * HOUSE RULES these tests follow (plan v5, lesson 11):
 *   * `signIn` only presses the button and the cookie arrives with the redirect, so every call is
 *     followed by `expect(page).toHaveURL(/\/projects\/recent$/)` before anything navigates.
 *   * Every account, brand, design name, order reference and **fabric key** is unique per run,
 *     because CI retries a failed browser test once and `ops_cut_batches` groups by factory,
 *     fabric, article and cut-off and reuses a batch it has already cut.
 *   * **No factory row is inserted.** `lib/home/book.ts` prices the whole catalogue from the first
 *     factory by slug, so a new slug sorting ahead of `sialkot-partner` would empty the price
 *     ladder other specs assert. The seeded placeholder is used as it is.
 *
 * A journey is several screens and several saves, so each one is given its own budget rather than
 * the file's 60 seconds.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const ok = <T extends { error: { message: string } | null }>(result: T): T => {
  if (result.error) throw new Error(result.error.message);
  return result;
};

const brandOf = async (email: string): Promise<string> => {
  const member = ok(await service().from("memberships").select("brand_id").eq("user_id", await userIdOf(email)).limit(1).single());
  return (member.data as { brand_id: string }).brand_id;
};

const run = (): string => randomUUID().slice(0, 8);

/** A fresh address for a context a test opens itself, so its rate limits are nobody else's. */
const ownAddress = (): Record<string, string> => ({
  "x-real-ip": `10.252.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`,
});

const signedIn = async (page: Page, label: string, brand: string): Promise<string> => {
  const email = await createAccount(label, { brand });
  await signIn(page, email);
  await expect(page).toHaveURL(/\/projects\/recent$/);
  return email;
};

// ---------------------------------------------------------------------------------------------
// 1. The founder: a base article, a golden sample, a run hand-off.
// ---------------------------------------------------------------------------------------------

const SNAPSHOT = (specVersion: number) => ({
  specVersion,
  patternBlockId: "crew-tee",
  patternBlockVersion: 1,
  fabricTestIds: [],
  printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
  rosterHash: null,
  files: [],
});

/**
 * The release, the product listing and one picture, exactly as `e2e/make.spec.ts` prepares them.
 * These three are the make flow's own preconditions and each has its own screen elsewhere in the
 * suite; a journey that re-walked all three would be testing those screens again, not the join.
 */
async function listAsProduct(email: string, projectId: string, name: string): Promise<void> {
  const db = service();
  const userId = await userIdOf(email);
  const project = ok(await db.from("projects").select("brand_id, current_version").eq("id", projectId).single());
  const { brand_id: brandId, current_version: version } = project.data as { brand_id: string; current_version: number };
  ok(
    await db.rpc("create_release", {
      p_project_id: projectId,
      p_brand_id: brandId,
      p_user_id: userId,
      p_label: "Round 1",
      p_snapshot: SNAPSHOT(version),
      p_file_specs: [],
      p_order_id: null,
    }),
  );
  ok(await db.rpc("create_brand_product", { p_brand_id: brandId, p_user_id: userId, p_project_id: projectId, p_name: name }));
  ok(
    await db.from("files").insert({
      brand_id: brandId,
      bucket: "uploads",
      path: `${brandId}/journeys-v5/${randomUUID()}.png`,
      kind: "photo",
      // A golden sample's picture is a photograph somebody took of the sample, and nothing a model
      // made (security review v5 H1, migration 20261215010000). The column's default is the strict
      // value, so a seed that says nothing is refused by `add_golden_sample_photo`.
      provenance: "uploaded",
      content_type: "image/png",
      bytes: 10,
      created_by: userId,
    }),
  );
}

test.describe("the founder journey (R3)", () => {
  test("goes from a base article to a signed-off golden sample to a run, and the production package names the care label", async ({ page }) => {
    test.setTimeout(180_000);
    const id = run();
    const email = await signedIn(page, "r3-founder", `Founder Athletic ${id}`);

    // The catalogue of base articles: every one the platform can make.
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { level: 1, name: "Base products and templates" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Base products" }).locator("> li")).toHaveCount(8);

    // The base article this journey is made from. TEE-TR-01 is one of the seven that publish no
    // measurement at all (decision 0090), and the size chart says so instead of showing a table.
    await page.goto("/catalogue/TEE-TR-01");
    await expect(page.getByRole("region", { name: "Size chart" })).toContainText(
      "This article has no measurements on file yet. The build pack gives them for the worked article only.",
    );
    // Wall 2, where a founder meets it first: the market panel has a Delivery row and no date in it.
    // This article has no factory capability either, so its lead time is named alongside the two
    // parts that are unset for every market; the two are asserted without the joining words.
    const market = page.getByRole("region", { name: /^Selling in / });
    await expect(market).toContainText("No delivery date yet");
    await expect(market).toContainText("the days for QC and the freight days");
    // Wall 1, in the market's own words: no care symbol exists, so no care line can be printed.
    await expect(market).toContainText("ISO 3758 is a paid standard and is not in this repository");
    await expect(market).not.toContainText(/Delivery 20\d\d-/);

    // The hand-off into the editor. It is a sentence and a plain link: no article code is carried
    // over, so the founder picks the garment again by its name on the next screen.
    const start = page.getByRole("region", { name: "Start a design from this base" });
    await expect(start).toContainText('Choose "Crew neck tee" on the next screen.');
    await start.getByRole("link", { name: "New design" }).click();
    await expect(page).toHaveURL(/\/studio\/new$/);

    const name = `Founder tee ${id}`;
    await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
    await page.getByLabel("Made for").selectOption({ label: "Women" });
    await page.getByLabel("Design name").fill(name);
    await page.getByRole("button", { name: "Create design" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const projectId = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
    expect(projectId).not.toBe("");

    await listAsProduct(email, projectId, name);
    // A crew tee is Class B, so a person at Knitwright has to have looked at the design before a
    // run starts (spec F-G1; security review v5 H3, decision 0116). This journey is about reaching
    // the production package; `e2e/make.spec.ts` tests the refusal and the allowance themselves.
    await allowClassBRun(projectId, "founder-reviewer");

    // The make hub, reached the way the editor offers it: the File menu.
    await page.getByTestId("file-menu-button").click();
    await page.getByRole("list", { name: "File" }).getByRole("link", { name: "Make and order" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/${projectId}/make$`));
    await expect(page.getByRole("heading", { level: 1, name: "Product created" })).toBeVisible();
    // No capability covers TEE-TR-01, so there is no price; and there is no date for anybody.
    await expect(page.getByText("No price is on file for this article yet.").first()).toBeVisible();
    await expect(page.getByText(/No delivery date yet/)).toBeVisible();
    // The run is shut, and the reason is the golden sample rather than a greyed-out button alone.
    const runCard = page.getByRole("heading", { level: 3, name: "Order a run" }).locator("..");
    await expect(runCard.getByText(/No golden sample has been signed off/)).toBeVisible();
    await expect(runCard.getByText("Select sizes")).toHaveAttribute("aria-disabled", "true");

    // A sample, on its own fabric so no other spec's batch is touched.
    await page.getByRole("link", { name: "Order a sample" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/${projectId}/make/sample$`));
    await page.getByLabel("Fabric", { exact: true }).fill(`r3-founder-${id}`);
    await page.getByRole("button", { name: "Send the sample request" }).click();
    await expect(page.getByText(/Sent to production/)).toBeVisible();

    // The golden sample: the photo, what the tape read, the marks, the sign-off.
    await page.goto(`/studio/${projectId}/make/golden-sample`);
    await expect(page.getByRole("heading", { level: 1, name: "Golden sample" })).toBeVisible();
    await page.getByRole("button", { name: "Start judging it" }).click();
    await expect(page.getByRole("heading", { name: "A photo of the sample" })).toBeVisible();
    await page.getByRole("button", { name: "Attach it" }).click();
    await expect(page.getByText(/1 photo on file/)).toBeVisible();
    await page.getByLabel("Point", { exact: true }).fill("A");
    await page.getByLabel("Code", { exact: true }).fill("chest_1cm_below_armhole");
    await page.getByLabel("Measured, mm", { exact: true }).fill("532");
    await page.getByLabel("Should be, mm", { exact: true }).fill("530");
    await page.getByLabel("Tolerance minus", { exact: true }).fill("10");
    await page.getByLabel("Tolerance plus", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Record the measurement" }).click();
    await expect(page.getByText(/is 2 mm off, inside minus 10 to plus 10 mm/)).toBeVisible();
    await page.getByRole("button", { name: "Sign this sample off" }).click();
    await expect(page.getByText(/Signed off by the founder/)).toBeVisible();

    // With a sign-off on file the run opens, and the order is handed to production.
    await page.goto(`/studio/${projectId}/make`);
    await expect(runCard.getByText(/A golden sample of this version has been signed off/)).toBeVisible();
    await page.getByRole("link", { name: "Select sizes" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/${projectId}/make/order$`));
    await page.getByRole("heading", { level: 3, name: new RegExp(name) }).waitFor();
    // The run screen has a "Ready to ship by" filter and nothing to put in it.
    await expect(page.getByRole("group", { name: "Filter the products" })).toContainText("Ready to ship by: no date yet");
    await page.getByLabel("Size M", { exact: true }).fill("60");
    await expect(page.getByText(/60 pieces/)).toBeVisible();
    await page.getByRole("button", { name: "Hand this order to production" }).click();
    await expect(page.getByText(/Sent to production: 1 order/)).toBeVisible();

    // AND HERE THE JOURNEY STOPS. The order exists, but the thing a factory makes the garment from
    // cannot be built. There is no screen for this at all -- the Export panel's own tab says the
    // package is built "when the order is placed" and offers no download -- so the only way to
    // reach the refusal is the route the Store would call.
    const answer = await page.request.get(`/api/projects/${projectId}/production-package`);
    expect(answer.status()).toBe(409);
    const refused = (await answer.json()) as { success: boolean; error: { code: string; message: string; fields?: Record<string, string[]> } };
    expect(refused.success).toBe(false);
    expect(refused.error.code).toBe("conflict");

    /*
     * AND IT IS THE F-G2 GATE THAT STOPS IT, which is the point of this assertion.
     *
     * R3's own review found that it was not. `lib/kpp/sources/server.ts` wrote the design object
     * through `toDesignObjectV2` first -- an export format, which refuses a design whose colourway
     * has no screen colour, as a design made from this base article has, because nothing on the way
     * here sets one. And the drafter has a script for one article only, so for TEE-TR-01 its own
     * refusal answered next. Either way the checklist never ran and **the care label of decision
     * 0089 was named nowhere a founder could reach**. The route now reads the design's facts
     * (`designObjectFacts`) and runs the gate before it drafts anything, so the refusal is about the
     * garment: every gap in one answer, each sentence carrying the rule it comes from.
     *
     * There is still no screen for any of this. The wall is that a founder has to call a route to
     * hear it, which is R3's finding and stands.
     */
    expect(refused.error.message).toContain("This production package cannot be built yet.");
    expect(refused.error.message).toMatch(/Care label [A-Z]{2}: missing [^.]*\./);
    expect(refused.error.message).not.toContain("the export format");
    // Every gap, with its dotted path and its rule id, so the founder is told what each one is.
    const gaps = refused.error.fields?.package ?? [];
    expect(gaps.some((line) => /^labels\[\d+\]: Care label [A-Z]{2}: missing [^(]*\(R-[A-Z]+-\d{3}\)$/.test(line))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// 2. The club: crest to kit, committee approval, the roster, the hand-off.
// ---------------------------------------------------------------------------------------------

/** A crest of three flat bands, drawn here so no club's artwork is committed (as crest-to-kit.spec.ts). */
const crest = async (): Promise<Buffer> =>
  sharp({ create: { width: 300, height: 300, channels: 3, background: "#1b2a49" } })
    .composite([
      { input: { create: { width: 100, height: 300, channels: 3, background: "#d4af37" } }, left: 100, top: 0 },
      { input: { create: { width: 100, height: 300, channels: 3, background: "#c8102e" } }, left: 200, top: 0 },
    ])
    .png()
    .toBuffer();

const CSV = "Name,Number,Size,Cut\nAna Reyes,10,M,women\nBo Tran,11,L,men\nCy Lowe,12,S,junior\n";

test.describe("the club journey (R3)", () => {
  test("goes from a crest to a kit to a committee approval to a roster, and names what stops the lock and the hand-off", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const id = run();
    const brand = `Crest Rovers ${id}`;
    await signedIn(page, "r3-club", brand);

    // Crest to kit. There is no door to it in the top bar (decision 0105), so it is opened directly.
    await page.goto("/crest-to-kit");
    await expect(page.getByRole("heading", { level: 1, name: "Crest to kit" })).toBeVisible();
    await page.getByLabel("Your club crest").setInputFiles({ name: "crest.png", mimeType: "image/png", buffer: await crest() });
    await page.getByRole("button", { name: /Show me kits/ }).click();
    await expect(page.getByTestId("crest-to-kit-kits")).toBeVisible({ timeout: 60_000 });
    const cards = page.getByTestId("crest-to-kit-card");
    expect(await cards.count()).toBeGreaterThanOrEqual(6);
    // The club's own colours came back off its own crest, and no delivery date came with them.
    await expect(page.getByTestId("crest-to-kit-palette")).toContainText("#1b2a49");
    await expect(page.getByTestId("crest-to-kit")).toContainText("No delivery date can be shown yet");

    // One card opens that kit in the configurator, and Save makes it a design of this club.
    await cards.first().getByRole("link", { name: "Open in the configurator" }).click();
    await expect(page.getByTestId("teamwear-configurator")).toBeVisible();
    // The last button is a hand-off and it waits for a saved design, which it says rather than fails.
    await page.getByTestId("teamwear-handoff").click();
    await expect(page.getByTestId("teamwear-handoff-note")).toContainText("Save the kit first");
    await page.getByTestId("teamwear-save").click();
    await expect(page).toHaveURL(/\/teamwear\?.*project=[0-9a-f-]{36}/);

    // THE HAND-OFF. There is no screen in this platform that sends a club's kit to production:
    // `submit_order_for_production` is called by the separate Store with its own key. What the club
    // can press hands the Store a reference to the saved version, and says so in those words.
    await page.getByTestId("teamwear-handoff").click();
    await expect(page.getByTestId("teamwear-handoff-note")).toContainText(/reference: [0-9a-f-]{36}@v\d/);
    await expect(page.getByTestId("teamwear-footer")).not.toContainText("Add to cart");

    // The committee link, made on Collect. The design is the only one this club has.
    await page.goto("/collect");
    await expect(page.getByRole("heading", { level: 1, name: "Ask your committee and your squad" })).toBeVisible();
    const design = page.getByRole("listitem").filter({ hasText: brand }).first();
    await design.getByRole("button", { name: "Make a committee link" }).click();
    const address = await page.getByTestId("committee-link-address").inputValue();
    expect(address).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

    // A committee member on a phone, with no account at all.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await standInForBotCheck(phone);
    await phone.setExtraHTTPHeaders(ownAddress());
    const guest = await phone.newPage();
    const opened = await guest.goto(address);
    expect(opened?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(guest.getByTestId("committee-option-A")).toBeVisible();

    const approve = guest.locator("form").filter({ has: guest.getByRole("button", { name: "Approve" }) });
    await approve.getByLabel("Your name").fill("Dana the treasurer");
    await approve.getByLabel("Your email (optional)").fill("dana@example.test");
    await passBotCheck(approve);
    await approve.getByRole("button", { name: "Approve" }).click();
    await expect(guest.getByText("Your approval is recorded with your name, the time and the option you chose.")).toBeVisible();

    /*
     * The club sees the approval, with who, when and against which version.
     *
     * The version is **2**, not 1: `saveKitAction` creates the project and then saves the kit's
     * colourway as a second version, so a kit is already at version 2 the moment it is saved. The
     * committee panel pre-ticks the current version, so that is the one the committee saw. Asserted
     * as "some version" rather than a number, because the number is the configurator's business.
     */
    await page.reload();
    const link = page.getByTestId("committee-link").first();
    await expect(link.getByTestId("committee-approvals")).toContainText(/Dana the treasurer approved version \d/);
    await expect(link.getByTestId("committee-approvals")).toContainText("dana@example.test");

    // AND HERE THE COMMITTEE LEG STOPS. Locking the approved version needs that version checked
    // against a factory profile, and this kit has never been checked: the refusal says so in the
    // form's own summary rather than crashing or locking anything.
    await link.getByRole("button", { name: /^Lock version \d/ }).first().click();
    await expect(summary(page)).toContainText("has not been checked against a factory profile");
    await expect(page.getByTestId("committee-lock")).toHaveCount(0);
    await phone.close();

    // The roster. A season, then the squad's own names, numbers and sizes.
    await page.goto("/club");
    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    await seasons.getByLabel("New season").fill(`2026 ${id}`);
    await seasons.getByRole("button", { name: "Make season" }).click();
    await expect(seasons.getByText("The season is made.")).toBeVisible();
    await seasons.getByLabel("Read players from a CSV file").setInputFiles({ name: "roster.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await seasons.getByRole("button", { name: "Save roster" }).click();
    await expect(seasons.getByText("Saved 3 players.")).toBeVisible();

    // And the half a squad fills in itself, on a link with no account behind it. The sign-up link
    // belongs to a season, so it is made inside that season's own row on Collect.
    await page.goto("/collect");
    const season = page.getByRole("listitem").filter({ hasText: `2026 ${id}` }).first();
    await season.getByLabel("Sport").selectOption("football");
    await season.getByRole("button", { name: "Make a sign-up link" }).click();
    const joinAddress = await page.getByTestId("signup-link-address").inputValue();
    expect(joinAddress).toMatch(/\/join\/[A-Za-z0-9_-]{43}$/);

    const squadPhone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await standInForBotCheck(squadPhone);
    await squadPhone.setExtraHTTPHeaders(ownAddress());
    const player = await squadPhone.newPage();
    await player.goto(joinAddress);
    await expect(player.getByTestId("signup-season-name")).toContainText(`2026 ${id}`);
    await player.getByLabel("Name on your shirt").fill("OKONKWO");
    await player.getByLabel("Your size").selectOption("M");
    // A number the sport does not allow is refused in the sport's own words, not silently kept.
    await player.getByLabel("Your number").fill("0");
    await passBotCheck(player);
    await player.getByRole("button", { name: "Send my details" }).click();
    await expect(player.getByText("A football number is 1 to 99.")).toBeVisible();
    await player.getByLabel("Your number").fill("7");
    await passBotCheck(player);
    await player.getByRole("button", { name: "Send my details" }).click();
    await expect(player.getByText("Your club has your shirt name, your number and your size.")).toBeVisible();
    await squadPhone.close();

    // The club sees the answer come in and folds it into the season's own roster.
    await page.goto("/collect");
    const filled = page.getByRole("listitem").filter({ hasText: `2026 ${id}` }).first();
    await expect(filled.getByTestId("collect-row").filter({ hasText: "OKONKWO" })).toBeVisible();
    await filled.getByRole("button", { name: "Put the answers in the roster" }).click();
    await expect(filled.getByTestId("signup-applied")).toContainText("added");
  });
});

// ---------------------------------------------------------------------------------------------
// 3. Ops: a batch, the job packet, QC, the shipment.
// ---------------------------------------------------------------------------------------------

/**
 * An order the Store has placed, on its own factory profile and its own fabric, of 400 pieces so
 * the AQL table's own band and the third-party inspection threshold are both exercised.
 *
 * The cut itself is made by the function the screen's own button calls, with the clock moved past
 * the cut-off. **The button cannot do it**: it passes `now()`, and a new order's cut-off is the
 * next weekly one, so no browser test can cut its own batch from the screen. That is asserted
 * below as the state of the batch screen before the cut, and recorded in `docs/reviews/coverage-v5.md`.
 */
async function storeOrder(email: string, ref: string, profile: string, fabric: string): Promise<{ orderId: string; cutoffAt: string }> {
  const db = service();
  const userId = await userIdOf(email);
  const brandId = await brandOf(email);
  const project = ok(
    await db.rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: userId,
      p_name: `R3 ops jersey ${ref}`,
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the R3 journey" },
      p_schema_version: 1,
    }),
  );
  const release = ok(
    await db.rpc("create_release", {
      p_project_id: project.data,
      p_brand_id: brandId,
      p_user_id: userId,
      p_label: "R3 round",
      p_snapshot: SNAPSHOT(1),
      p_file_specs: [],
      p_order_id: null,
    }),
  );
  ok(
    await db.rpc("submit_order_for_production", {
      p_release_id: (release.data as { id: string }[])[0]?.id,
      p_external_ref: ref,
      p_factory_profile_id: profile,
      p_fabric_key: fabric,
      p_article_id: "crew-tee",
      p_sizes: { M: 200, L: 200 },
      p_value_minor: 1_160_000,
      p_currency: "GBP",
    }),
  );
  const placed = ok(await db.from("ops_orders").select("id, cutoff_at").eq("external_ref", ref).single());
  const order = placed.data as { id: string; cutoff_at: string };
  return { orderId: order.id, cutoffAt: order.cutoff_at };
}

test.describe("the ops journey (R3)", () => {
  test("goes from a batch to the factory's own job packet to a passed inspection to a shipment, and names what stops the invoice", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const id = run();
    const ref = `E2E-R3-${Date.now()}`;
    const email = await createAccount("r3-ops", { brand: `Ops Journey ${id}` });
    await makePlatformAdmin(email);
    const { orderId, cutoffAt } = await storeOrder(email, ref, `r3-factory-${id}`, `r3-fabric-${id}`);

    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);

    // The batch screen, before the cut. The order is waiting, and no due date is promised to it.
    await page.goto("/ops");
    await expect(page.getByRole("heading", { level: 1, name: "Batches", exact: true })).toBeVisible();
    await expect(page.getByTestId("waiting-order").filter({ hasText: ref })).toBeVisible();
    await expect(page.getByText(/No lead time is set, so no due date is promised/)).toBeVisible();

    // The cut, by the function the screen's button calls, with the clock past this order's cut-off.
    ok(await service().rpc("ops_cut_batches", { p_actor: await userIdOf(email), p_now: new Date(Date.parse(cutoffAt) + 1000).toISOString() }));

    await page.goto("/ops");
    await page.getByRole("link", { name: new RegExp(`crew-tee, r3-fabric-${id}`) }).first().click();
    await expect(page).toHaveURL(/\/ops\/batches\/[0-9a-f-]{36}$/);
    const inBatch = page.getByTestId("batch-order").filter({ hasText: ref });
    await expect(inBatch).toBeVisible();
    // Wall 2 on the ops side: the Promised column of a real batch is empty, and says so.
    await expect(inBatch).toContainText("Not set");

    // The job packet: the one address a factory with no account opens the batch at.
    const packet = page.getByRole("region", { name: "Factory link" });
    await packet.getByLabel("Days the link works").fill("7");
    await packet.getByRole("button", { name: "Make factory link" }).click();
    const shown = packet.getByTestId("job-packet-address");
    await expect(shown).toContainText("It is shown only now: copy it.");
    const jobAddress = (await shown.locator("code").innerText()).trim();
    expect(jobAddress).toMatch(/\/job\/[A-Za-z0-9_-]{43}$/);
    const token = jobAddress.split("/job/")[1];

    // The factory, in its own context with no session and its own address.
    const factoryContext = await browser.newContext();
    await factoryContext.setExtraHTTPHeaders(ownAddress());
    const factory = await factoryContext.newPage();
    const served = await factory.goto(jobAddress);
    expect(served?.status()).toBe(200);
    expect(served?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(factory.getByRole("heading", { level: 1, name: "Job packet: crew-tee" })).toBeVisible();
    // Wall 2 again, on the one screen a factory sees: the due date is the first thing on it.
    await expect(factory.getByTestId("job-due")).toContainText("Due date: Not set");
    await expect(factory.getByText(/No lead time has been set, so no due date is promised yet/)).toBeVisible();
    // The sheet and the ZIP are both really served, not a dead link.
    const sheet = await factory.request.get(`/api/job/${token}/sheet`);
    expect(sheet.status()).toBe(200);
    expect((await sheet.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const files = await factory.request.get(`/api/job/${token}/files`);
    expect(files.status()).toBe(200);
    expect(files.headers()["content-type"]).toBe("application/zip");

    // The factory moves the batch on, one step at a time: only the next step is ever offered.
    await expect(factory.getByRole("button", { name: "In production" })).toHaveCount(0);
    await factory.getByRole("button", { name: "Received" }).click();
    await expect(factory.getByTestId("job-history").first()).toContainText("Received");
    await factory.getByRole("button", { name: "In production" }).click();
    await expect(factory.getByTestId("job-history").first()).toContainText("In production");
    await factory.getByRole("button", { name: "Ready for QC" }).click();
    await expect(factory.getByText(/This batch is marked Ready for QC/)).toBeVisible();
    await factoryContext.close();

    // QC, with the sampling plan the order's own size falls into.
    await page.goto(`/ops/orders/${orderId}/qc`);
    await expect(page.getByRole("heading", { level: 1, name: `Quality control: ${ref}` })).toBeVisible();
    await expect(page.getByTestId("aql-sentence")).toContainText("Inspection level II");
    await expect(page.getByTestId("aql-plan")).toContainText("Code letter H, 50 pieces inspected out of 400");
    // The table is honest about where it came from, and says so on the screen that uses it.
    await expect(page.getByTestId("aql-unsourced")).toContainText("ISO 2859-1");
    for (const label of [
      "Result: measurements against the size spec, on a sample",
      "Result: colour against the swatch",
      "Result: artwork placement",
      "Result: names and numbers against the team list",
    ]) {
      await page.getByLabel(label).selectOption("pass");
    }
    await page.getByLabel("Measurement lines").fill("Chest width, 520, 522, 5");
    await page.getByLabel("Colour readings").fill("Kit navy, 1.2");
    await page.getByLabel("Pieces inspected").fill("50");
    await page.getByLabel("Pieces with a defect").fill("0");
    await page.getByRole("button", { name: "Record inspection" }).click();
    await expect(page.getByText("Inspection recorded: pass")).toBeVisible();
    // The reading is kept and shown, and nothing pretends to judge it: this factory is not on file,
    // so it has no agreed colour difference and the line says the figure alone.
    await expect(page.getByTestId("colour-reading")).toContainText("Kit navy reads Delta-E 1.2");
    await expect(page.getByTestId("colour-reading")).not.toContainText(/within the|over the/);
    // A run over 300 pieces may be inspected by a third party, and nothing is booked by a stub.
    await page.getByRole("button", { name: "Ask for an inspection" }).click();
    await expect(page.getByTestId("inspection-booking")).toContainText("Nothing booked");

    // Packing: the bags the shipment is made of.
    await page.goto(`/ops/orders/${orderId}/packing`);
    await expect(page.getByRole("heading", { level: 1, name: `Packing: ${ref}` })).toBeVisible();
    await page.getByRole("button", { name: /^Make the bags/ }).click();
    await expect(page.getByTestId("bag").first()).toBeVisible();

    // The shipment. It waited for an inspection that passes, and that one did.
    await page.goto(`/ops/orders/${orderId}/shipping`);
    await expect(page.getByTestId("fulfilment")).toContainText("Not shipped");
    await expect(page.getByTestId("ship-blocker")).toHaveCount(0);
    // Nothing is sent to a courier, and the screen never suggests otherwise.
    await expect(page.getByTestId("fulfilment")).toContainText("Entered by hand. Nothing is sent to a courier");

    // AND HERE THE PAPERWORK STOPS. The goods can go, but the invoice that goes with them cannot
    // be written: this order's factory is not a row in `factories`, so the country the goods were
    // made in is not known and no origin is guessed. The refusal names the screen that fixes it.
    await expect(page.getByTestId("invoice-blocker")).toHaveCount(0);
    await page.getByLabel("Country the goods are going to").selectOption("GB");
    await page.getByRole("button", { name: "Issue the invoice" }).click();
    await expect(summary(page)).toContainText("/ops/factories");
    await expect(page.getByTestId("invoice")).toHaveCount(0);

    // The parcel itself is recorded, and the order is shipped.
    await page.getByLabel("Courier", { exact: true }).fill("DHL");
    await page.getByLabel("Tracking number").fill(`R3-${id}`);
    await page.getByLabel("Shipped on").fill("2026-11-02");
    await page.getByLabel("Pieces sent, by size").fill("M 200, L 200");
    await page.getByRole("button", { name: "Record parcel" }).click();
    await expect(page.getByTestId("parcel")).toHaveCount(1);
    await expect(page.getByTestId("fulfilment")).toContainText("Shipped");

    /*
     * Wall 2, the last time: the customer is told there is no date rather than given a guess.
     *
     * The message to write has to be chosen. The screen offers the one that matches the order's
     * state, and a parcel has just been recorded, so the one it offers is "Sent" -- which carries
     * the courier and the tracking number and **no date line at all**, because there is nothing to
     * promise once the goods have gone. The six messages that are sent while an order is still
     * being made are the ones that carry `NO_DATE_LINE`, so one of those is chosen here.
     */
    await page.goto(`/ops/orders/${orderId}`);
    await page.getByLabel("What the message is about").selectOption({ label: "Ready at the factory" });
    await page.getByLabel("Customer's email address").fill("club@example.com");
    await page.getByRole("button", { name: /Write the message|Send the message/ }).click();
    await expect(page.getByTestId("email-body")).toContainText("not giving you a delivery date yet");
    // And no date is in it anywhere, under any wording.
    await expect(page.getByTestId("email-body")).not.toContainText(/\b20\d\d-\d\d-\d\d\b/);
  });
});
