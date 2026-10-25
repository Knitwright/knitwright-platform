import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Decision 0060, the pattern service: a brand sends a design with no pattern to the Sialkot team, ops accepts it, attaches the
 * DXF files and delivers it, and the brand sees the files labelled as not reviewed by a technician. No price is set in the test
 * database, so the screen says Knitwright will confirm the price and nothing is charged.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const DXF = "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n";

/** A design of the shorts, which the library has no pattern for, in a brand the account owns. */
async function shortsDesign(email: string): Promise<string> {
  const db = service();
  const userId = await userIdOf(email);
  const membership = await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single();
  const project = await db.rpc("create_project", {
    p_brand_id: membership.data?.brand_id as string, p_user_id: userId, p_name: "Pattern shorts", p_style_number: "", p_season: "",
    p_garment_type: "shorts", p_spec: { made: "for the test" }, p_schema_version: 1,
  });
  if (project.error) throw new Error(project.error.message);
  return project.data as string;
}

test.describe("the pattern service", () => {
  test("a request goes from the brand through ops and comes back with files", async ({ page }) => {
    const email = await createAccount("pattern-service");
    await makePlatformAdmin(email);
    const projectId = await shortsDesign(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto(`/studio/${projectId}/pattern-service`);
    await expect(page.getByTestId("pattern-price")).toContainText("Knitwright will confirm the price.");
    await expect(page.getByTestId("pattern-turnaround")).toContainText("Knitwright will confirm the turnaround.");
    await page.getByRole("button", { name: "Request a pattern" }).click();
    await expect(page.getByText(/Sent to the Sialkot team/)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("pattern-request-status")).toContainText("Requested");
    await expect(page.getByRole("button", { name: "Request a pattern" })).toHaveCount(0);

    const found = await service().from("pattern_requests").select("id").eq("project_id", projectId).single();
    if (found.error) throw new Error(found.error.message);
    const requestId = found.data.id as string;

    await page.goto("/ops/pattern-requests");
    await page.locator(`a[href="/ops/pattern-requests/${requestId}"]`).click();
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByTestId("request-status")).toContainText("Accepted by the Sialkot team");
    await page.getByRole("button", { name: "Mark in progress" }).click();
    await expect(page.getByTestId("request-status")).toContainText("Being drafted");

    await page.locator('input[type="file"]').setInputFiles({ name: "shorts-m.dxf", mimeType: "application/dxf", buffer: Buffer.from(DXF) });
    await page.getByRole("button", { name: "Attach files" }).click();
    await expect(page.getByText(/1 attached/)).toBeVisible();
    await page.getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.getByTestId("request-status")).toContainText("Delivered");

    await page.goto(`/studio/${projectId}/pattern-service`);
    await expect(page.getByTestId("pattern-request-status")).toContainText("Pattern from the Sialkot team, not reviewed by a technician");
    const link = page.getByRole("link", { name: /Download pattern file 1/ });
    const response = await page.request.get((await link.getAttribute("href")) ?? "");
    expect(response.status()).toBe(200);
    expect((await response.text()).startsWith("0\nSECTION")).toBe(true);
  });

  test("another brand cannot see the request or its files, and a member cannot reach the ops queue", async ({ page }) => {
    const owner = await createAccount("pattern-owner");
    const projectId = await shortsDesign(owner);
    const other = await createAccount("pattern-other");
    await signIn(page, other);
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto(`/studio/${projectId}/pattern-service`))?.status()).toBe(404);
    expect((await page.goto("/ops/pattern-requests"))?.status()).toBe(404);
    const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
    expect((await page.request.get(`/api/projects/${projectId}/pattern-service/${id}/files/${id}`)).status()).toBe(404);
  });
});
