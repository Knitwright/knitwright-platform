import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Decision 0072, spec F-O2: a factory gets a link to one batch and no account. Ops makes the link on the batch
 * page; the link opens the packet in a browser with no session, where the factory presses Received and the
 * batch's orders move on; once the link is revoked it is the page that does not exist.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const check = <T>(result: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
};

/** A release for a brand the account owns, an order for it the way the Store submits one, then the batch. */
async function batchFor(email: string, ref: string): Promise<void> {
  const db = service();
  const userId = await userIdOf(email);
  const membership = check(await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single()) as { brand_id: string };
  const brandId = membership.brand_id;
  const project = check(
    await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: "Packet jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 }),
  ) as string;
  const release = check(
    await db.rpc("create_release", {
      p_project_id: project, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1 jerseys",
      p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] },
      p_file_specs: [], p_order_id: null,
    }),
  ) as { id: string }[];
  check(
    await db.rpc("submit_order_for_production", {
      p_release_id: release[0]!.id, p_external_ref: ref, p_factory_profile_id: "knitwright-default",
      p_fabric_key: "mesh-140", p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 },
    }),
  );
  // The test cannot wait for Friday: cut the batches as of just after this order's cut-off, as ops would.
  const placed = check(await db.from("ops_orders").select("cutoff_at").eq("external_ref", ref).single()) as { cutoff_at: string };
  check(await db.rpc("ops_cut_batches", { p_actor: userId, p_now: new Date(Date.parse(placed.cutoff_at) + 1000).toISOString() }));
}

const statusOf = async (ref: string): Promise<string> =>
  (check(await service().from("ops_orders").select("status").eq("external_ref", ref).single()) as { status: string }).status;

test.describe("the factory's job packet", () => {
  test("ops makes a link, the factory opens it with no account and records Received, then ops revokes it", async ({ page, browser }) => {
    const email = await createAccount("packet-admin", { brand: "Northside Cricket Club" });
    await makePlatformAdmin(email);
    const ref = `E2E-PACKET-${Date.now()}`;
    await batchFor(email, ref);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/ops");
    await page.getByRole("link", { name: /crew-tee, mesh-140/ }).first().click();
    await expect(page.getByTestId("batch-order").filter({ hasText: ref })).toBeVisible();

    // Ops makes the link. Its address is shown once, and only now.
    const section = page.getByRole("region", { name: "Factory link" });
    await expect(section.getByRole("button", { name: "Make factory link" })).toBeVisible();
    await section.getByRole("button", { name: "Make factory link" }).click();
    const address = await section.getByTestId("job-packet-address").locator("code").innerText();
    expect(address).toMatch(/\/job\/[A-Za-z0-9_-]{43}$/);
    await expect(section.getByText("No WhatsApp number given")).toBeVisible();
    await expect(section.getByTestId("job-packet-state")).toContainText("Open until");

    // The factory: a new browser with no session at all.
    const factory = await browser.newContext();
    // Its own address, so its rate limits are not shared with other tests.
    await factory.setExtraHTTPHeaders({ "x-real-ip": `10.251.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}` });
    const theirs = await factory.newPage();
    const response = await theirs.goto(address);

    expect(response?.status()).toBe(200);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(theirs.getByRole("heading", { level: 1, name: /Job packet/ })).toBeVisible();
    await expect(theirs.getByTestId("job-due")).toBeVisible();
    await expect(theirs.getByTestId("job-order").filter({ hasText: ref })).toBeVisible();
    await expect(theirs.getByRole("heading", { name: "Sizes" })).toBeVisible();
    await expect(theirs.getByRole("heading", { name: "Names and numbers" })).toBeVisible();
    await expect(theirs.getByRole("heading", { name: "Materials (BOM)" })).toBeVisible();
    // No session, so nothing of the signed-in app is offered.
    await expect(theirs.locator('a[href^="/ops"]')).toHaveCount(0);
    await expect(theirs.locator('a[href^="/studio"]')).toHaveCount(0);

    // The files the factory needs, behind the same token.
    const sheet = await theirs.request.get(`/api/job/${address.split("/job/")[1]}/sheet`);
    expect(sheet.status()).toBe(200);
    expect(sheet.headers()["content-type"]).toBe("application/pdf");
    expect((await sheet.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const zip = await theirs.request.get(`/api/job/${address.split("/job/")[1]}/files`);
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toBe("application/zip");

    // Received: the one button offered, and it moves the batch's orders on.
    expect(await statusOf(ref)).toBe("batched");
    await expect(theirs.getByRole("button", { name: "In production" })).toHaveCount(0);
    await theirs.getByLabel("Note with this step (optional)").fill("Files received, cutting Monday.");
    await theirs.getByRole("button", { name: "Received" }).click();
    await expect(theirs.getByText("Recorded.")).toBeVisible();
    await expect(theirs.getByTestId("job-history").first()).toContainText("Received");
    await expect(theirs.getByRole("button", { name: "In production" })).toBeVisible();
    expect(await statusOf(ref)).toBe("received");

    // Ops sees what the factory recorded, with the note.
    await page.reload();
    await expect(section.getByTestId("factory-event").filter({ hasText: "Files received, cutting Monday." })).toBeVisible();
    await expect(section.getByTestId("factory-event").first()).toContainText("order");

    // Revoked: the same address is the page that does not exist.
    await section.getByRole("button", { name: "Revoke factory link" }).click();
    await expect(page.getByRole("button", { name: "Make factory link" })).toBeVisible();
    const gone = await theirs.goto(address);
    expect(gone?.status()).toBe(404);
    await expect(theirs.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect((await theirs.request.get(`/api/job/${address.split("/job/")[1]}/sheet`)).status()).toBe(404);
    await factory.close();
  });

  test("a made-up link is the page that does not exist, and its files are too", async ({ page }) => {
    const token = "A".repeat(43);

    expect((await page.goto(`/job/${token}`))?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect((await page.request.get(`/api/job/${token}/sheet`)).status()).toBe(404);
    expect((await page.request.get(`/api/job/${token}/files`)).status()).toBe(404);
    expect((await page.request.post(`/api/job/${token}/photos`, { multipart: { photo: { name: "a.png", mimeType: "image/png", buffer: Buffer.from([0]) } } })).status()).toBe(404);
  });

  test("a photo a factory sent is for platform admins only", async ({ page }) => {
    const email = await createAccount("packet-member", { brand: "Bayside FC" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    expect((await page.request.get("/api/job/events/6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11/photo")).status()).toBe(404);
  });
});
