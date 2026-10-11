import { describe, expect, it, vi } from "vitest";
import { CHARTS, fullDesign } from "@/lib/techpack/fixtures/designs";
import type { FileReader } from "@/lib/storage/read";
import { loadSharePage, type ShareLoadDeps } from "./public-load";
import type { OpenShare } from "./service";
import { newShareToken } from "./token";

const BRAND = "9b1e0c4a-2d3f-4a5b-8c7d-6e5f4a3b2c1d";
const PICTURE = "5e3d2c1b-0a9f-4e8d-b7c6-a5b4c3d2e1f0";

const withPicture = () => {
  const spec = fullDesign("crew-tee");
  return {
    ...spec,
    artwork: [{ ...spec.artwork[0], id: "logo", source: { kind: "file" as const, fileId: PICTURE } }],
  };
};

const opened = (patch: Partial<OpenShare> = {}): OpenShare => ({
  linkId: "0e1d2c3b-4a59-4687-8796-a5b4c3d2e1f0",
  brandId: BRAND,
  brandName: "Northside Hockey Club",
  projectName: "Home kit 2027",
  version: 2,
  isCurrent: true,
  spec: withPicture(),
  savedAt: "2026-10-04T09:30:00Z",
  expiresAt: "2026-11-03T09:30:00Z",
  ...patch,
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const deps = (patch: Partial<ShareLoadDeps> = {}): ShareLoadDeps => {
  const reader: FileReader = { read: vi.fn(async () => ({ bytes: PNG, contentType: "image/png" })) };
  return {
    open: vi.fn(async () => opened()),
    charts: vi.fn(async () => CHARTS),
    reader: vi.fn(() => reader),
    shrink: vi.fn(async (file) => ({ bytes: file.bytes, contentType: "image/png" as const })),
    ...patch,
  };
};

describe("loadSharePage", () => {
  it("draws the version the link opens, with the brand's charts and the pictures its artwork uses", async () => {
    const given = deps();
    const token = newShareToken();

    const page = await loadSharePage(given, token);

    expect(given.open).toHaveBeenCalledWith(token);
    expect(given.charts).toHaveBeenCalledWith(BRAND, undefined);
    expect(given.reader).toHaveBeenCalledWith(BRAND);
    const reader = vi.mocked(given.reader).mock.results[0].value as FileReader;
    expect(vi.mocked(reader.read).mock.calls.map(([id]) => id)).toEqual([PICTURE]);
    expect(page?.page).toMatchObject({ designName: "Home kit 2027", brandName: "Northside Hockey Club", version: 2 });
    expect(page?.picturesNote).toBeNull();
    expect(decodeURIComponent(page?.page.flats[0].src ?? "")).toContain("data:image/png;base64,");
  });

  it("uses the charts in force when an older version was saved", async () => {
    const given = deps({ open: vi.fn(async () => opened({ isCurrent: false })) });

    await loadSharePage(given, newShareToken());

    expect(given.charts).toHaveBeenCalledWith(BRAND, "2026-10-04T09:30:00Z");
  });

  it("is null for a link that does not open, and reads nothing else", async () => {
    const given = deps({ open: vi.fn(async () => null) });

    expect(await loadSharePage(given, newShareToken())).toBeNull();
    expect(given.charts).not.toHaveBeenCalled();
    expect(given.reader).not.toHaveBeenCalled();
  });

  it("is null for a malformed token, without asking the database", async () => {
    const given = deps();

    expect(await loadSharePage(given, "not-a-token")).toBeNull();
    expect(given.open).not.toHaveBeenCalled();
  });

  it("says when a picture could not be shown", async () => {
    const given = deps({ reader: vi.fn(() => ({ read: vi.fn(async () => "too-large" as const) })) });

    expect((await loadSharePage(given, newShareToken()))?.picturesNote).toMatch(/1 picture is not shown/);
  });
});
