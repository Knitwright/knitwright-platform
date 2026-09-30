import { describe, expect, it } from "vitest";
import {
  BRAND_STORAGE_QUOTA_BYTES,
  QUOTA_ERROR_CODE,
  STORAGE_FULL_MESSAGE,
  isQuotaRefusal,
  storageRoom,
} from "./quota";

const MB = 1024 * 1024;

describe("the brand storage quota", () => {
  it("is 500 MB, as the owner decided on 2026-09-30", () => {
    expect(BRAND_STORAGE_QUOTA_BYTES).toBe(500 * MB);
  });

  it("says plainly what is full and what to do", () => {
    expect(STORAGE_FULL_MESSAGE).toMatch(/500 MB/);
    expect(STORAGE_FULL_MESSAGE).toMatch(/Delete/);
  });
});

describe("storageRoom", () => {
  it("lets a file in while the total stays within the quota", () => {
    expect(storageRoom(0, 8 * MB)).toEqual({ ok: true });
    expect(storageRoom(492 * MB, 8 * MB)).toEqual({ ok: true });
  });

  it("refuses a file that would pass the quota by one byte", () => {
    expect(storageRoom(492 * MB + 1, 8 * MB)).toEqual({ ok: false, message: STORAGE_FULL_MESSAGE });
  });

  it("refuses anything once the brand is at or over the quota", () => {
    expect(storageRoom(500 * MB, 1).ok).toBe(false);
    expect(storageRoom(600 * MB, 1).ok).toBe(false);
  });

  it("takes another quota when given one", () => {
    expect(storageRoom(9, 1, 10)).toEqual({ ok: true });
    expect(storageRoom(10, 1, 10).ok).toBe(false);
  });

  it("refuses nonsense amounts rather than letting them through", () => {
    expect(() => storageRoom(-1, 1)).toThrow();
    expect(() => storageRoom(0, Number.NaN)).toThrow();
  });
});

describe("isQuotaRefusal", () => {
  it("recognises the database's refusal by its code", () => {
    expect(isQuotaRefusal({ code: QUOTA_ERROR_CODE, message: "The brand's storage quota is used up." })).toBe(true);
  });

  it("does not mistake other errors for it", () => {
    expect(isQuotaRefusal({ code: "23503", message: "foreign key" })).toBe(false);
    expect(isQuotaRefusal(null)).toBe(false);
    expect(isQuotaRefusal("KWQ01")).toBe(false);
  });
});
