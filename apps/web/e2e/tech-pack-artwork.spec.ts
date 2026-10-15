import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { writeStack, type ArtworkStack } from "../lib/artwork-stack";
import type { GarmentSpec } from "../lib/garment";
import { CREST_LAYER, GROUND_STACK, IMPORT_REPORT, PICTURE_STACK } from "../lib/techpack/fixtures/stacks";
import { createAccount, signIn, test } from "./support";

/**
 * Plan W5 phase B: the artwork and colour page is built from the artwork stack of the design, whatever made it.
 * One design comes from a picture the user uploaded, one from a picture the user had read into a design.
 * Nothing here calls a provider. The reading is a row the server would have written when the user accepted it.
 */

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error("The design has no address.");
  return id;
};

const userOf = async (email: string): Promise<string> => {
  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = data?.users.find((user) => user.email === email);
  if (error || !found) throw new Error("No such account.");
  return found.id;
};

const brandOf = async (userId: string): Promise<string> => {
  const { data, error } = await admin().from("memberships").select("brand_id").eq("user_id", userId).single();
  if (error) throw new Error(error.message);
  return data.brand_id as string;
};

/** Saves the stack as the next version of the design, with the older fields set from it, as the editor does. */
const saveStack = async (projectId: string, userId: string, stack: ArtworkStack): Promise<void> => {
  const db = admin();
  const { data, error } = await db.from("spec_versions").select("version, spec").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single();
  if (error) throw new Error(error.message);
  const next = writeStack(data.spec as GarmentSpec, stack, data.version as number);
  const saved = await db.rpc("append_spec_version", {
    p_project_id: projectId,
    p_user_id: userId,
    p_expected_version: data.version,
    p_spec: next,
    p_schema_version: next.schemaVersion,
    p_note: "Artwork added by a test",
    p_restored_from: null,
  });
  if (saved.error) throw new Error(saved.error.message);
};

const openSection = async (page: Page, projectId: string, section: string): Promise<void> => {
  await page.goto(`/studio/${projectId}/tech-pack?section=${section}`);
};

test.describe("the artwork and colour page of a design with an artwork stack (W5 phase B)", () => {
  test("a design with the user's own uploaded picture lists the layer, its resolution and the repeat spec, and the factory list asks about a soft picture", async ({ page }) => {
    const email = await createAccount("pack-upload");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Upload test");

    // A 400 px crest printed 90 mm wide is about 113 dpi, below the default minimum of 150.
    const crest = await sharp({ create: { width: 400, height: 400, channels: 4, background: "#c8102e" } }).png().toBuffer();
    const response = await page.request.post("/api/artwork", { multipart: { rights: "yes", file: { name: "crest.png", mimeType: "image/png", buffer: crest } } });
    expect(response.status()).toBe(200);
    const { data: artwork } = await response.json();
    const assetId = artwork.id as string;

    const stack: ArtworkStack = { ...GROUND_STACK, layers: [...GROUND_STACK.layers, { ...CREST_LAYER, source: { kind: "asset", assetId } }] };
    await saveStack(projectId, await userOf(email), stack);

    await openSection(page, projectId, "artwork-and-colour");
    await expect(page.getByRole("heading", { level: 2, name: "Artwork and colour", exact: true })).toBeVisible();
    await expect(page.getByTestId("stack-description")).toContainText("Club crest");
    await expect(page.locator('[data-layer="crest"]')).toContainText("Placed picture");
    await expect(page.locator('[data-layer="crest"]')).toContainText("Crest zone");
    const image = page.locator(`[data-image="crest"]`);
    await expect(image).toHaveAttribute("data-result", "below");
    await expect(image).toContainText("400 x 400 px");
    await expect(page.getByText("Knitwright default, not from your print house.").first()).toBeVisible();

    await openSection(page, projectId, "readiness");
    const item = page.locator('[data-item="print-image-dpi"]');
    await expect(item).toHaveAttribute("data-met", "false");
    await expect(item).toContainText("Use a larger file for");
    await expect(item.getByTestId("owner-input")).toContainText("Open owner input P14");
    await expect(item.getByTestId("owner-input")).toContainText("Until then: 150 dpi is used as the warning level");
  });

  test("a design read from a picture shows the report, the limits and who accepted it, and says it is a close reading", async ({ page }) => {
    const email = await createAccount("pack-picture");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Picture test");
    const userId = await userOf(email);
    const brandId = await brandOf(userId);

    const layerIds = PICTURE_STACK.layers.map((layer) => layer.id);
    const inserted = await admin().from("design_imports").insert({
      brand_id: brandId,
      source_file_id: randomUUID(),
      rights_accepted_at: new Date().toISOString(),
      status: "accepted",
      reading: {},
      report: IMPORT_REPORT,
      overlay: {},
      result: PICTURE_STACK,
      accepted_stack: PICTURE_STACK,
      accepted_layer_ids: layerIds,
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
      created_by: userId,
    });
    expect(inserted.error).toBeNull();
    await saveStack(projectId, userId, PICTURE_STACK);

    await openSection(page, projectId, "artwork-and-colour");
    await expect(page.getByTestId("picture-read")).toContainText("close reading of your picture");
    await expect(page.getByTestId("picture-acceptance")).toContainText(/Accepted by: .+ on \d{1,2} [A-Z][a-z]{2} \d{4}/);
    await expect(page.getByLabel("What to keep in mind about a design read from a picture")).toContainText("Logos are redrawn, not extracted");

    await openSection(page, projectId, "readiness");
    const item = page.locator('[data-item="print-picture-read"]');
    await expect(item).toHaveAttribute("data-met", "true");
    await expect(item).toContainText("The design read from a picture was accepted by");
  });
});
