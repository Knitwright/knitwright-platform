import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { AppError } from "@/lib/server/core/errors";
import { loadUploads, rightsOf, uploadRowOf, wordingTextOf } from "./uploads";

/**
 * The uploads panel's own read (plan v5, decision 0106).
 *
 * What is proved here is that the panel shows **the record and nothing more**: the day a person
 * said they own the file, the version of the words they saw, and those words when this repository
 * still holds that version. A version it no longer holds answers null, so a sentence somebody has
 * since changed is never put in a person's mouth.
 */

const BRAND = "22222222-2222-4222-8222-222222222222";

type Row = Parameters<typeof rightsOf>[0];

const row = (over: Partial<Row> & { warnings?: unknown } = {}): Row & { warnings: unknown } => ({
  id: "33333333-3333-4333-8333-333333333333",
  kind: "raster" as const,
  source_format: "png" as const,
  label: "Club crest",
  width_px: 1200,
  height_px: 900,
  rights_confirmed_at: "2026-10-03T09:30:00.000Z",
  rights_wording_version: LOGO_RIGHTS.version,
  warnings: ["This picture sits on a white box."],
  ...over,
});

function readClient(rows: readonly unknown[], error: { message: string } | null = null) {
  const asked: { column: string; value: unknown }[] = [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => (asked.push({ column, value }), query),
    order: () => query,
    limit: async () => ({ data: rows, error }),
  };
  return { client: { from: () => query } as unknown as SupabaseClient, asked };
}

describe("the rights recorded on one file", () => {
  it("are the day, the version and the words that were on screen", () => {
    const rights = rightsOf(row());
    expect(rights.when).toBe("3 Oct 2026");
    expect(rights.wordingVersion).toBe(LOGO_RIGHTS.version);
    expect(rights.wordingText).toBe(LOGO_RIGHTS.text);
  });

  it("say nothing at all for a version this repository no longer holds", () => {
    expect(wordingTextOf("logo-rights-v99")).toBeNull();
    expect(rightsOf(row({ rights_wording_version: "logo-rights-v99" })).wordingText).toBeNull();
  });

  it("leave the day empty rather than guessing when the stamp cannot be read", () => {
    expect(rightsOf(row({ rights_confirmed_at: "not a date" })).when).toBe("");
  });
});

describe("one row of the panel", () => {
  it("says what the file is in words a person uses, and carries its own warnings", () => {
    const built = uploadRowOf(row(), ["This picture sits on a white box."]);
    expect(built.kindLabel).toBe("Picture");
    expect(built.detail).toBe("PNG, 1200 × 900 px");
    expect(built.warnings).toEqual(["This picture sits on a white box."]);
  });

  it("calls a vector a drawing, because that is the word a person would use", () => {
    expect(uploadRowOf(row({ kind: "vector", source_format: "svg" }), []).kindLabel).toBe("Drawing");
    expect(uploadRowOf(row({ kind: "vector", source_format: "ai" }), []).detail).toContain("Illustrator");
  });
});

describe("reading the brand's uploads", () => {
  it("asks for this brand's rows only, newest first", async () => {
    const { client, asked } = readClient([row()]);
    const view = await loadUploads(client, BRAND);
    expect(asked).toEqual([{ column: "brand_id", value: BRAND }]);
    expect(view.total).toBe(1);
    expect(view.rows[0]?.label).toBe("Club crest");
  });

  it("reports a failed read, and a row it cannot read", async () => {
    await expect(loadUploads(readClient([], { message: "boom" }).client, BRAND)).rejects.toBeInstanceOf(AppError);
    await expect(loadUploads(readClient([{ id: "not an id" }]).client, BRAND)).rejects.toBeInstanceOf(AppError);
  });

  it("keeps a row whose warnings column is not a list of words, rather than losing the file", async () => {
    const view = await loadUploads(readClient([{ ...row(), warnings: "surprise" }]).client, BRAND);
    expect(view.rows[0]?.warnings).toEqual([]);
  });

  it("answers an empty list for a brand with nothing uploaded", async () => {
    expect(await loadUploads(readClient([]).client, BRAND)).toEqual({ rows: [], total: 0 });
  });
});
