import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { seedTemplates } from "../lib/templates/seed/seed";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Plan v4 W5-C: one journey for each role, start to finish. The pieces are covered one by one in the
 * other specs; these check that they join up. A release is frozen with the server's key, as in
 * brand-runs.spec.ts, because freezing one needs the print file builder. Models are stand-ins in CI.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

const CSV = "Name,Number,Size,Cut\nAna Reyes,10,M,women\nBo Tran,11,L,men\nCy Lowe,12,S,junior\n";

const TITLE = `E2E journey hoops ${Math.random().toString(36).slice(2, 8)}`;

test.beforeAll(async () => {
  await seedTemplates(service());
});

// Other specs count the library, so the template the designer journey makes is removed again.
test.afterAll(async () => {
  await service().from("templates").delete().eq("title", TITLE);
});

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`No design id in ${page.url()}`);
  return id;
};

const brandOf = async (email: string): Promise<string> => {
  const member = await service().from("memberships").select("brand_id").eq("user_id", await userIdOf(email)).single();
  if (member.error) throw new Error(member.error.message);
  return member.data.brand_id as string;
};

const freeze = async (email: string, projectId: string, label: string): Promise<string> => {
  const release = await service().rpc("create_release", { p_project_id: projectId, p_brand_id: await brandOf(email), p_user_id: await userIdOf(email), p_label: label, p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null });
  if (release.error) throw new Error(release.error.message);
  return (release.data as { id: string }[])[0]?.id ?? "";
};

const orderStatus = async (ref: string): Promise<{ id: string; status: string; cutoff_at: string }> => {
  const order = await service().from("ops_orders").select("id, status, cutoff_at").eq("external_ref", ref).single();
  if (order.error) throw new Error(order.error.message);
  return order.data as { id: string; status: string; cutoff_at: string };
};

test.describe("role journeys (W5-C)", () => {
  test("a club kit manager goes from a template to a shipped order through ops", async ({ page, browser }) => {
    const email = await createAccount("journey-club", { brand: "Journey FC" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    // A starter template becomes the club's design, at version 1.
    await page.goto("/templates?sport=football&article=team-jersey");
    await page.getByRole("button", { name: "Use this template: Navy and gold hoops" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("version")).toHaveText("Version 1");
    const projectId = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";

    // The season's roster is read from a file and saved.
    await page.goto("/club");
    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    await seasons.getByLabel("New season").fill("2026");
    await seasons.getByRole("button", { name: "Make season" }).click();
    await expect(seasons.getByText("The season is made.")).toBeVisible();
    await seasons.getByLabel("Read players from a CSV file").setInputFiles({ name: "roster.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await seasons.getByRole("button", { name: "Save roster" }).click();
    await expect(seasons.getByText("Saved 3 players.")).toBeVisible();

    // The order reaches ops the way the Store sends it, and is cut into a batch.
    const ref = `E2E-J-${Date.now()}`;
    const releaseId = await freeze(email, projectId, "Round 1 kit");
    const submitted = await service().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref, p_factory_profile_id: "knitwright-default", p_fabric_key: "mesh-140", p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 } });
    if (submitted.error) throw new Error(submitted.error.message);
    const placed = await orderStatus(ref);
    expect(placed.status).toBe("submitted");

    // Ops, in its own session: cut, receive, make, inspect, pack and ship.
    const adminEmail = await createAccount("journey-club-ops");
    await makePlatformAdmin(adminEmail);
    const cut = await service().rpc("ops_cut_batches", { p_actor: await userIdOf(adminEmail), p_now: new Date(Date.parse(placed.cutoff_at) + 1000).toISOString() });
    if (cut.error) throw new Error(cut.error.message);
    expect((await orderStatus(ref)).status).toBe("batched");

    const opsPage = await (await browser.newContext()).newPage();
    await signIn(opsPage, adminEmail);
    await expect(opsPage).toHaveURL(/\/studio$/);
    await opsPage.goto("/ops");
    await opsPage.getByRole("link", { name: /crew-tee, mesh-140/ }).first().click();
    await expect(opsPage.getByTestId("batch-order").filter({ hasText: ref })).toBeVisible();
    await opsPage.getByRole("link", { name: ref }).click();
    await opsPage.getByRole("button", { name: /Mark received/i }).click();
    await expect(opsPage.getByText("Received by the factory").first()).toBeVisible();
    expect((await orderStatus(ref)).status).toBe("received");
    for (const to of ["in_production", "ready"]) {
      const step = await service().rpc("ops_set_order_status", { p_actor: await userIdOf(adminEmail), p_order_id: placed.id, p_to: to });
      if (step.error) throw new Error(step.error.message);
    }
    expect((await orderStatus(ref)).status).toBe("ready");

    await opsPage.goto(`/ops/orders/${placed.id}/qc`);
    for (const label of ["Result: measurements against the size spec, on a sample", "Result: colour against the swatch", "Result: artwork placement", "Result: names and numbers against the team list"]) {
      await opsPage.getByLabel(label).selectOption("pass");
    }
    await opsPage.getByLabel("Measurement lines").fill("Chest width, 520, 522, 5");
    await opsPage.getByLabel("Pieces inspected").fill("5");
    await opsPage.getByLabel("Pieces with a defect").fill("0");
    await opsPage.getByRole("button", { name: "Record inspection" }).click();
    await expect(opsPage.getByText("Inspection recorded: pass")).toBeVisible();

    await opsPage.goto(`/ops/orders/${placed.id}/packing`);
    await opsPage.getByRole("button", { name: "Make the bags" }).click();
    await expect(opsPage.getByTestId("bag").first()).toBeVisible();

    await opsPage.goto(`/ops/orders/${placed.id}/shipping`);
    await opsPage.getByLabel("Courier").fill("DHL");
    await opsPage.getByLabel("Tracking number").fill("JOURNEY-1");
    await opsPage.getByLabel("Shipped on").fill("2026-10-30");
    await opsPage.getByLabel("Pieces sent, by size").fill("M 3, L 2");
    await opsPage.getByRole("button", { name: "Record parcel" }).click();
    await expect(opsPage.getByTestId("fulfilment")).toContainText("Shipped");
    await expect(opsPage.getByTestId("parcel")).toHaveCount(1);
  });

  test("a brand runs a product from sample to run and both orders are durable in ops", async ({ page }) => {
    const email = await createAccount("journey-brand", { brand: "Journey Apparel" });
    // Ops cuts the batches at the end, which only a platform admin may do.
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Journey hoodie");
    await freeze(email, projectId, "Round 1");

    await page.goto("/brand");
    const products = page.getByRole("region", { name: "Product list" });
    await products.getByLabel("Design to list").selectOption({ label: "Journey hoodie" });
    await products.getByRole("button", { name: "Add to product list" }).click();
    await expect(page).toHaveURL(/\/brand\?product=/);

    const builder = page.getByRole("region", { name: "Run builder" });
    const sizeBoxes = builder.getByPlaceholder("0");
    const addSizes = async (): Promise<void> => {
      if ((await sizeBoxes.count()) > 0) return;
      for (const label of ["S", "M"]) {
        await builder.getByLabel("Size label", { exact: true }).fill(label);
        await builder.getByRole("button", { name: "Add size" }).click();
      }
    };

    await builder.getByLabel("Fabric").fill("Journey mesh");
    await addSizes();
    await sizeBoxes.nth(0).fill("1");
    await sizeBoxes.nth(1).fill("1");
    await builder.getByRole("button", { name: "Order sample" }).click();
    await expect(builder.getByRole("alert")).toHaveCount(0);
    const sent = page.getByRole("region", { name: "Sent to ops" });
    await expect(sent.getByText(/Journey hoodie · Sample · 2 pieces/)).toBeVisible();

    await products.getByRole("button", { name: "Move to sample stage" }).click();
    await expect(products.getByText("Journey hoodie is now at the sample stage.")).toBeVisible();
    await products.getByRole("button", { name: "Happy with the sample, move to run stage" }).click();
    await expect(products.getByText("Journey hoodie is now at the run stage.")).toBeVisible();

    // Moving the stage opens a fresh builder: wait for it before naming the fabric again.
    await expect(builder.getByRole("option", { name: "Sample: one piece per size" })).toBeDisabled();
    await builder.getByLabel("Fabric").fill("Journey mesh");
    await addSizes();
    await sizeBoxes.nth(0).fill("20");
    await sizeBoxes.nth(1).fill("40");
    await expect(builder.getByText("Total: 60 pieces")).toBeVisible();
    await expect(builder.getByText("No minimum order is set for this garment yet")).toBeVisible();
    await expect(builder.getByRole("button", { name: "Order run" })).toBeDisabled();
    await builder.getByLabel("I have read these notes and want to send this anyway.").check();
    await expect(builder.getByRole("button", { name: "Order run" })).toBeEnabled();
    await builder.getByRole("button", { name: "Order run" }).click();
    await expect(builder.getByRole("alert")).toHaveCount(0);
    await expect(sent.getByText(/Journey hoodie · Brand run · 60 pieces/)).toBeVisible();

    // The durable record: two ops orders for the brand, both submitted, and two brand runs.
    const brandId = await brandOf(email);
    const orders = await service().from("ops_orders").select("external_ref, status").eq("brand_id", brandId);
    if (orders.error) throw new Error(orders.error.message);
    expect(orders.data).toHaveLength(2);
    for (const order of orders.data) {
      expect(order.external_ref).toContain("brand-run:");
      expect(order.status).toBe("submitted");
    }
    const runs = await service().from("brand_runs").select("kind, pieces").eq("brand_id", brandId).order("pieces");
    if (runs.error) throw new Error(runs.error.message);
    expect(runs.data).toEqual([{ kind: "sample", pieces: 2 }, { kind: "run", pieces: 60 }]);

    // Ops cuts them into batches, as it would on the day, so they do not stay in the waiting list other specs draw.
    const cutoffs = await service().from("ops_orders").select("cutoff_at").eq("brand_id", brandId);
    const latest = Math.max(...(cutoffs.data ?? []).map((row) => Date.parse(row.cutoff_at as string)));
    const cut = await service().rpc("ops_cut_batches", { p_actor: await userIdOf(email), p_now: new Date(latest + 1000).toISOString() });
    if (cut.error) throw new Error(cut.error.message);
    const batched = await service().from("ops_orders").select("status").eq("brand_id", brandId);
    expect(batched.data?.map((row) => row.status)).toEqual(["batched", "batched"]);
  });

  test("a designer offers a design and it is accepted into the library", async ({ page, browser }) => {
    await signIn(page, await createAccount("journey-designer"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/designer");
    await page.getByLabel("Name to show on your templates").fill("Ida Journey");
    await page.getByRole("button", { name: "Become a designer" }).click();
    await expect(page.getByRole("heading", { name: "Your submissions" })).toBeVisible();

    await page.goto("/templates?sport=football&article=team-jersey");
    await page.getByRole("button", { name: "Use this template: Navy and gold hoops" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);

    await page.goto("/designer/new");
    await page.getByLabel("Design to offer").selectOption({ label: "Navy and gold hoops" });
    await page.getByLabel("Template title").fill(TITLE);
    await page.getByLabel("Sport").selectOption("football");
    await page.getByLabel("Style").selectOption("hoops");
    await page.getByLabel("Main colour").selectOption("blue");
    await page.getByRole("button", { name: "Save as a draft" }).click();
    await expect(page.getByText("Saved as a draft.")).toBeVisible();

    await page.goto("/designer");
    const entry = page.getByTestId("submission").filter({ hasText: TITLE });
    await entry.getByRole("button", { name: `Send for review: ${TITLE}` }).click();
    await entry.getByLabel(/I hold the rights to every artwork/).check();
    await entry.getByRole("button", { name: `Send for review: ${TITLE}` }).click();
    await expect(entry).toContainText("Waiting for Knitwright to review");

    const adminPage = await (await browser.newContext()).newPage();
    const adminEmail = await createAccount("journey-designer-admin");
    await makePlatformAdmin(adminEmail);
    await signIn(adminPage, adminEmail);
    await expect(adminPage).toHaveURL(/\/studio$/);
    await adminPage.goto("/admin/templates");
    const queued = adminPage.getByTestId("queue-entry").filter({ hasText: TITLE });
    await expect(queued).toContainText("Rights statement made");
    await queued.getByRole("button", { name: `Accept: ${TITLE}` }).click();
    await expect(queued).toHaveCount(0);

    const stored = await service().from("templates").select("title").eq("title", TITLE);
    expect(stored.data).toHaveLength(1);
    await page.goto("/designer");
    await expect(page.getByTestId("submission").filter({ hasText: TITLE })).toContainText("Live in the template library");
  });
});
