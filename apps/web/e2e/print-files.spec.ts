import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { deriveStack, parseArtworkStack, writeStack } from "../lib/artwork-stack";
import type { GarmentSpec } from "../lib/garment";
import { createAccount, signIn, test } from "./support";

/**
 * Plan W3: print files for any design, made from the pattern library's pattern and the design's own artwork. The
 * pattern is the benchmark DXF kept in docs/owner/reference, added through the pattern library as a technician would.
 */

const BENCHMARK_DXF = join(__dirname, "../../../docs/owner/reference/fashioninsta-2026-10-14/pattern_1598.dxf");
const LOGO_COLOUR = "#12ab34";
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><path d="M0 0H100V60H0Z" fill="${LOGO_COLOUR}"/></svg>`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

async function startDesignWithPattern(page: Page, name: string): Promise<string> {
  await signIn(page, await createAccount("print-files"));
  await expect(page).toHaveURL(/\/studio$/);
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const designPath = new URL(page.url()).pathname;
  await page.goto(`${designPath}?tool=production`);
  await expect(page.getByRole("heading", { name: "Patterns" })).toBeVisible();
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Add a pattern from DXF files" }) });
  await form.getByLabel("Product").selectOption({ label: "Crew tee" });
  await form.getByLabel("Does the outline already include seam allowance?").selectOption({ label: "No: the outline is the sewn size (add seam allowance)" });
  await form.getByLabel("DXF files").setInputFiles(BENCHMARK_DXF);
  await form.getByRole("button", { name: "Add the pattern" }).click();
  await expect(page.getByText(/Stored as version 1: 48\./)).toBeVisible();
  const projectId = designPath.split("/").pop() ?? "";
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
  return projectId;
}

const zipOf = async (page: Page, projectId: string, query = ""): Promise<Record<string, Uint8Array>> => {
  const response = await page.request.get(`/api/projects/${projectId}/print-files?formats=pdf,svg${query}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/zip");
  expect(response.headers()["cache-control"]).toBe("no-store");
  return unzipSync(new Uint8Array(await response.body()));
};

const textOf = (bytes: Uint8Array | undefined): string => new TextDecoder().decode(bytes ?? new Uint8Array());

test.describe("print files (W3)", () => {
  test("a design's print zip holds a PDF and an SVG for each piece, with a manifest, and says which pattern they come from", async ({ page }) => {
    const projectId = await startDesignWithPattern(page, "Print zip test");
    const files = await zipOf(page, projectId);
    const names = Object.keys(files);
    expect(names).toContain("manifest.csv");
    expect(names.filter((name) => name.endsWith(".pdf")).length).toBeGreaterThan(0);
    expect(names.filter((name) => name.endsWith(".svg")).length).toBeGreaterThan(0);
    expect(textOf(files["read-me.txt"])).toContain("Draft pattern, not reviewed.");
    const svg = names.find((name) => name.endsWith(".svg"));
    expect(textOf(files[svg ?? ""])).toMatch(/Draft pattern, not reviewed\./);
    expect(textOf(files["manifest.csv"]).split("\n")[0]).toContain("sha256");
  });

  test("the same zip for a design with the user's own artwork carries that artwork, still as vector", async ({ page }) => {
    const projectId = await startDesignWithPattern(page, "User art test");
    const plain = await zipOf(page, projectId);
    const uploaded = await page.request.post("/api/artwork", { multipart: { file: { name: "club-logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from(LOGO) }, rights: "yes" } });
    expect(uploaded.status()).toBe(200);
    const artwork = (await uploaded.json()) as { id?: string; data?: { id?: string } };
    const assetId = artwork.id ?? artwork.data?.id;
    expect(assetId).toMatch(/^[0-9a-f-]{36}$/);

    // No screen places a stored artwork on a design yet, so the stack is written the way the editor will write it.
    const db = admin();
    const row = await db.from("spec_versions").select("spec").eq("project_id", projectId).eq("version", 1).single();
    expect(row.error).toBeNull();
    const spec = row.data?.spec as GarmentSpec;
    const base = deriveStack(spec);
    const logo = {
      id: "club-logo", kind: "graphic", views: ["front"], opacity: 1, blend: "normal", provenance: "user-edited",
      source: { kind: "asset", assetId }, placement: { kind: "zone", zoneId: "crest" }, offsetMm: { x: 0, y: 0 }, widthMm: 60, rotationDeg: 0, clearSpaceMm: 10, knockOut: false,
    };
    const parsed = parseArtworkStack({ ...base, layers: [...base.layers, logo] });
    if (!parsed.ok) throw new Error(parsed.reason);
    const saved = await db.from("spec_versions").update({ spec: writeStack(spec, parsed.stack, 1) }).eq("project_id", projectId).eq("version", 1);
    expect(saved.error).toBeNull();

    const withArt = await zipOf(page, projectId);
    const front = Object.keys(withArt).find((name) => /front\.svg$/.test(name));
    expect(front).toBeDefined();
    expect(textOf(withArt[front ?? ""]).toLowerCase()).toContain(LOGO_COLOUR);
    expect(textOf(plain[front ?? ""]).toLowerCase()).not.toContain(LOGO_COLOUR);
    expect(textOf(withArt[front ?? ""])).not.toContain("<image");
  });
});
