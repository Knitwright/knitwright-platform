import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/fabrics/fixtures/fake-db";
import { AppError } from "@/lib/server/core/errors";
import type { FileReader } from "@/lib/storage/read";
import { TOO_LARGE } from "@/lib/storage/read";
import { DEFAULT_SETTINGS } from "../layout/context";
import { ICC_NOT_FOUND, iccName, loadPrintSettings, savePrintProfile } from "./settings";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const input = { bleedMm: 20, dpi: 200, minDpi: 175, maxPrintWidthMm: 1600, iccFileId: null };
const noFiles: FileReader = { read: async () => null };

/** A tiny ICC profile with one version 2 description tag. */
function icc(name: string): Uint8Array {
  const text = new TextEncoder().encode(name + "\0");
  const body = new Uint8Array(12 + text.length);
  new DataView(body.buffer).setUint32(8, text.length);
  body.set(new TextEncoder().encode("desc"), 0);
  body.set(text, 12);
  const bytes = new Uint8Array(132 + 12 + body.length);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("acsp"), 36);
  view.setUint32(128, 1);
  bytes.set(new TextEncoder().encode("desc"), 132);
  view.setUint32(136, 144);
  view.setUint32(140, body.length);
  bytes.set(body, 144);
  return bytes;
}

describe("print settings", () => {
  it("uses the Knitwright defaults, labelled, when the brand has set nothing", async () => {
    const db = fakeDb();
    expect(await loadPrintSettings(db.client, noFiles, who.brandId)).toEqual(DEFAULT_SETTINGS);
  });
  it("saves a profile once for the brand and reads it back as from the print house", async () => {
    const db = fakeDb();
    await savePrintProfile(db.client, who, input);
    await savePrintProfile(db.client, who, { ...input, bleedMm: 25 });
    expect(db.tables.print_profiles).toHaveLength(1);
    const settings = await loadPrintSettings(db.client, noFiles, who.brandId);
    expect(settings).toMatchObject({ bleedMm: 25, dpi: 200, minDpi: 175, maxPrintWidthMm: 1600, source: "print-house", iccBytes: null });
  });
  it("reads the colour profile through the brand's file reader and names it", async () => {
    const file = "33333333-3333-4333-8333-333333333333";
    const db = fakeDb({ files: [{ id: file, brand_id: who.brandId }] });
    await savePrintProfile(db.client, who, { ...input, iccFileId: file });
    const reader: FileReader = { read: async () => ({ bytes: icc("Test GRACoL"), contentType: "application/vnd.iccprofile" }) };
    const settings = await loadPrintSettings(db.client, reader, who.brandId);
    expect(settings.iccName).toBe("Test GRACoL");
    expect(settings.iccBytes).not.toBeNull();
    const tooBig: FileReader = { read: async () => TOO_LARGE };
    expect((await loadPrintSettings(db.client, tooBig, who.brandId)).iccBytes).toBeNull();
  });
  it("refuses a colour profile that is not one of the brand's files", async () => {
    const db = fakeDb({ files: [{ id: "33333333-3333-4333-8333-333333333333", brand_id: "99999999-9999-4999-8999-999999999999" }] });
    const error = await savePrintProfile(db.client, who, { ...input, iccFileId: "33333333-3333-4333-8333-333333333333" }).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toBe(ICC_NOT_FOUND);
  });
  it("reports a database failure instead of hiding it", async () => {
    const db = fakeDb();
    db.failOn("print_profiles", "select", { message: "boom" });
    await expect(loadPrintSettings(db.client, noFiles, who.brandId)).rejects.toThrow(/could not be read/);
    const db2 = fakeDb();
    db2.failOn("print_profiles", "insert", { message: "boom" });
    await expect(savePrintProfile(db2.client, who, input)).rejects.toThrow(/could not be saved/);
  });
  it("reads a profile's name, or says nothing when the file is not a profile", () => {
    expect(iccName(icc("Coated FOGRA39"))).toBe("Coated FOGRA39");
    expect(iccName(new Uint8Array(10))).toBeNull();
    expect(iccName(new Uint8Array(200))).toBeNull();
  });
});

describe("a version 4 profile name", () => {
  it("reads the first name in a multi-language description tag", () => {
    const text = new TextEncoder().encode("sRGB v4");
    const utf16 = new Uint8Array(text.length * 2);
    text.forEach((c, i) => new DataView(utf16.buffer).setUint16(i * 2, c));
    const body = new Uint8Array(28 + utf16.length);
    const v = new DataView(body.buffer);
    body.set(new TextEncoder().encode("mluc"), 0);
    v.setUint32(8, 1);
    v.setUint32(12, 12);
    v.setUint32(20, utf16.length);
    v.setUint32(24, 28);
    body.set(utf16, 28);
    const bytes = new Uint8Array(144 + body.length);
    const view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode("acsp"), 36);
    view.setUint32(128, 1);
    bytes.set(new TextEncoder().encode("desc"), 132);
    view.setUint32(136, 144);
    view.setUint32(140, body.length);
    bytes.set(body, 144);
    expect(iccName(bytes)).toBe("sRGB v4");
    view.setUint32(144 + 8, 0);
    expect(iccName(bytes)).toBeNull();
  });
  it("skips tags that are not the description", () => {
    const bytes = new Uint8Array(200);
    bytes.set(new TextEncoder().encode("acsp"), 36);
    new DataView(bytes.buffer).setUint32(128, 1);
    bytes.set(new TextEncoder().encode("wtpt"), 132);
    expect(iccName(bytes)).toBeNull();
  });
});
