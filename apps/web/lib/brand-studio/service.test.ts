import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  deletePalette,
  getClubKit,
  getProfile,
  listAssets,
  listFonts,
  listKitFonts,
  listPalettes,
  listUploads,
  loadBrand,
  loadRecord,
  saveAssets,
  saveFonts,
  savePalette,
  saveProfile,
} from "./service";
import { EMPTY_PROFILE } from "./types";

/**
 * Brand Studio against a stand-in client, so the shape of every read and every call is pinned
 * without a database. The database tests (tests/integration/brand-studio.test.ts) prove the rules.
 */

type Answer = { data?: unknown; error?: { message: string; code?: string } | null };
type Call = { table?: string; fn?: string; args?: unknown; select?: string; filters: unknown[] };

/** Answers each table (or rpc) with the row or rows given, and records what was asked. */
const fake = (answers: Readonly<Record<string, Answer>>) => {
  const calls: Call[] = [];
  const replyFor = (key: string) => {
    const answer = answers[key] ?? {};
    return { data: answer.data ?? null, error: answer.error ?? null };
  };
  const chain = (call: Call, key: string) => {
    const reply = replyFor(key);
    const q: Record<string, unknown> = {};
    q.select = (cols: string) => ((call.select = cols), q);
    for (const method of ["eq", "order", "limit"]) q[method] = (...args: unknown[]) => (call.filters.push([method, ...args]), q);
    q.maybeSingle = () => Promise.resolve(reply);
    q.then = (resolve: (value: unknown) => unknown) => resolve(reply);
    return q;
  };
  const client = {
    from: (table: string) => {
      const call: Call = { table, filters: [] };
      calls.push(call);
      return chain(call, table);
    },
    rpc: (fn: string, args: unknown) => {
      const call: Call = { fn, args, filters: [] };
      calls.push(call);
      return Promise.resolve(replyFor(fn));
    },
  } as unknown as SupabaseClient;
  return { client, calls };
};

const BRAND = { id: "b1", name: "Test FC" };
const WHO = { brandId: "b1", userId: "u1" };

const PROFILE_ROW = {
  category: "club",
  kind: "club",
  website: "https://example.test",
  about: "A club in the north.",
  voice_tags: ["community", "nonsense"],
  setting: "A wet pitch.",
  art_direction: "Long lens.",
  rules_boundaries: "No sleeve sponsor.",
  default_size_range: ["S", "M"],
};

describe("getProfile", () => {
  it("reads the row and keeps only the tags the spec names", async () => {
    const { client, calls } = fake({ brand_profiles: { data: PROFILE_ROW } });
    const profile = await getProfile(client, "b1");
    expect(profile).toEqual({
      kind: "club",
      category: "club",
      website: "https://example.test",
      about: "A club in the north.",
      voiceTags: ["community"],
      style: { setting: "A wet pitch.", artDirection: "Long lens.", rulesBoundaries: "No sleeve sponsor." },
      defaultSizeRange: ["S", "M"],
    });
    expect(calls[0]!.filters).toEqual([["eq", "brand_id", "b1"]]);
  });

  it("reads a brand that has saved nothing as the empty profile, not as a guess", async () => {
    expect(await getProfile(fake({}).client, "b1")).toEqual(EMPTY_PROFILE);
  });

  it("reads a row that no longer fits the rules as the empty profile", async () => {
    expect(await getProfile(fake({ brand_profiles: { data: { category: "spaceship" } } }).client, "b1")).toEqual(EMPTY_PROFILE);
  });

  it("says so when the read itself fails", async () => {
    await expect(getProfile(fake({ brand_profiles: { error: { message: "down" } } }).client, "b1")).rejects.toMatchObject({ code: "internal" });
  });
});

describe("listPalettes", () => {
  it("puts the colours of each palette in the order the brand set", async () => {
    const data = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Primary",
        brand_colours: [
          { id: "33333333-3333-4333-8333-333333333333", name: "White", hex: "#ffffff", pantone_tcx: null, position: 2 },
          { id: "22222222-2222-4222-8222-222222222222", name: "Club red", hex: "#c8102e", pantone_tcx: "19-1664 TCX", position: 1 },
        ],
      },
    ];
    const palettes = await listPalettes(fake({ brand_palettes: { data } }).client, "b1");
    expect(palettes[0]!.colours.map((colour) => colour.name)).toEqual(["Club red", "White"]);
    expect(palettes[0]!.source).toBe("brand-studio");
  });

  it("reads no palette for a brand with none, and says so when the read fails", async () => {
    expect(await listPalettes(fake({}).client, "b1")).toEqual([]);
    await expect(listPalettes(fake({ brand_palettes: { error: { message: "down" } } }).client, "b1")).rejects.toMatchObject({ code: "internal" });
  });
});

describe("listFonts, listAssets, listKitFonts and listUploads", () => {
  it("reads the role and key of each font", async () => {
    const data = [{ role: "headline", font_key: "geist" }];
    expect(await listFonts(fake({ brand_fonts: { data } }).client, "b1")).toEqual([{ role: "headline", fontKey: "geist" }]);
  });

  it("reads a print width stored as text as a number, and no width as null", async () => {
    const data = [
      { id: "44444444-4444-4444-8444-444444444444", kind: "sponsor", artwork_id: "55555555-5555-4555-8555-555555555555", label: "Gas", sponsor_name: "Gas", print_width_mm: "180.5", position: 1 },
      { id: "66666666-6666-4666-8666-666666666666", kind: "crest", artwork_id: "77777777-7777-4777-8777-777777777777", label: "Crest", sponsor_name: null, print_width_mm: null, position: 1 },
    ];
    const assets = await listAssets(fake({ brand_assets: { data } }).client, "b1");
    expect(assets.map((asset) => asset.printWidthMm)).toEqual([180.5, null]);
    expect(assets.every((asset) => asset.source === "brand-studio")).toBe(true);
  });

  it("reads the font list with the licence note each row carries", async () => {
    const data = [{ key: "geist", label: "Geist Sans", family: "var(--font-sans)", licence: "bundled", licence_note: "SIL OFL 1.1", selectable: true }];
    expect(await listKitFonts(fake({ brand_studio_fonts: { data } }).client)).toEqual([
      { key: "geist", label: "Geist Sans", family: "var(--font-sans)", licence: "bundled", licenceNote: "SIL OFL 1.1", selectable: true },
    ]);
  });

  it("reads the brand's own uploads, newest first", async () => {
    const data = [{ id: "88888888-8888-4888-8888-888888888888", label: "Crest", kind: "vector", width_px: 10, height_px: 20 }];
    const { client, calls } = fake({ user_artworks: { data } });
    expect(await listUploads(client, "b1")).toEqual([{ artworkId: "88888888-8888-4888-8888-888888888888", label: "Crest", kind: "vector", widthPx: 10, heightPx: 20 }]);
    expect(calls[0]!.filters).toEqual([["eq", "brand_id", "b1"], ["order", "created_at", { ascending: false }], ["limit", 200]]);
  });

  it("says so when any of those reads fails", async () => {
    for (const table of ["brand_fonts", "brand_assets", "brand_studio_fonts", "user_artworks"]) {
      const { client } = fake({ [table]: { error: { message: "down" } } });
      const read =
        table === "brand_fonts"
          ? listFonts(client, "b1")
          : table === "brand_assets"
            ? listAssets(client, "b1")
            : table === "brand_studio_fonts"
              ? listKitFonts(client)
              : listUploads(client, "b1");
      await expect(read).rejects.toMatchObject({ code: "internal" });
    }
  });
});

describe("getClubKit", () => {
  it("reads the club kit as it is, sponsors included", async () => {
    const data = { primary_colour: "#0b3d91", secondary_colour: null, accent_colour: null, crest_file_id: "f1", sponsors: [{ name: "Gas", logoFileId: "f2" }] };
    expect(await getClubKit(fake({ club_kits: { data } }).client, "b1")).toEqual({
      primaryColour: "#0b3d91",
      secondaryColour: null,
      accentColour: null,
      crestFileId: "f1",
      sponsors: [{ name: "Gas", logoFileId: "f2" }],
    });
  });

  it("reads no club kit as nothing chosen, never as a guess", async () => {
    expect(await getClubKit(fake({}).client, "b1")).toEqual({
      primaryColour: null,
      secondaryColour: null,
      accentColour: null,
      crestFileId: null,
      sponsors: [],
    });
  });
});

describe("loadBrand", () => {
  it("puts the brand's own palettes first and the club kit's after, read through", async () => {
    const { record } = await loadBrand(
      fake({
        brand_profiles: { data: PROFILE_ROW },
        brand_palettes: { data: [{ id: "11111111-1111-4111-8111-111111111111", name: "Primary", brand_colours: [] }] },
        club_kits: { data: { primary_colour: "#0b3d91", secondary_colour: null, accent_colour: null, crest_file_id: "f1", sponsors: [] } },
      }).client,
      BRAND,
    );
    expect(record.palettes.map((palette) => [palette.name, palette.source])).toEqual([
      ["Primary", "brand-studio"],
      ["Club kit", "club-kit"],
    ]);
    expect(record.assets.map((asset) => [asset.kind, asset.source])).toEqual([["crest", "club-kit"]]);
    expect(record.brandName).toBe("Test FC");
  });

  it("shows no club-kit palette for a brand whose club chose no colour", async () => {
    const record = await loadRecord(fake({}).client, BRAND);
    expect(record.palettes).toEqual([]);
    expect(record.assets).toEqual([]);
  });
});

describe("writes", () => {
  it("sends the profile with the kind worked out from the category", async () => {
    const { client, calls } = fake({ brand_studio_save_profile: {} });
    await saveProfile(client, WHO, {
      category: "school",
      website: null,
      about: "",
      voiceTags: [],
      setting: "",
      artDirection: "",
      rulesBoundaries: "",
      defaultSizeRange: [],
    });
    expect(calls[0]).toMatchObject({ fn: "brand_studio_save_profile", args: { p_brand_id: "b1", p_user_id: "u1" } });
    expect((calls[0]!.args as { p_profile: { kind: string } }).p_profile.kind).toBe("club");
  });

  it("sends a palette and gives back the id the database made", async () => {
    const { client, calls } = fake({ brand_studio_save_palette: { data: "99999999-9999-4999-8999-999999999999" } });
    const id = await savePalette(client, WHO, { paletteId: null, name: "Kit colours", colours: [{ name: "Club red", hex: "#c8102e", pantoneTcx: null }] });
    expect(id).toBe("99999999-9999-4999-8999-999999999999");
    expect(calls[0]!.args).toMatchObject({ p_palette_id: null, p_name: "Kit colours" });
  });

  it("deletes a palette, and says plainly when there is none", async () => {
    const { client, calls } = fake({ brand_studio_delete_palette: {} });
    await deletePalette(client, WHO, "p1");
    expect(calls[0]).toMatchObject({ fn: "brand_studio_delete_palette", args: { p_palette_id: "p1" } });
    const gone = fake({ brand_studio_delete_palette: { error: { message: "no", code: "P0002" } } });
    await expect(deletePalette(gone.client, WHO, "p1")).rejects.toMatchObject({ code: "not_found" });
  });

  it("sends the fonts, and turns the database's refusal into one a person can read", async () => {
    const { client, calls } = fake({ brand_studio_save_fonts: {} });
    await saveFonts(client, WHO, { fonts: [{ role: "headline", fontKey: "geist" }] });
    expect(calls[0]!.args).toMatchObject({ p_fonts: [{ role: "headline", fontKey: "geist" }] });
    const refused = fake({ brand_studio_save_fonts: { error: { message: "no", code: "42501" } } });
    await expect(saveFonts(refused.client, WHO, { fonts: [] })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("sends one kind of picture at a time and gives back how many were stored", async () => {
    const { client, calls } = fake({ brand_studio_save_assets: { data: 2 } });
    const count = await saveAssets(client, WHO, {
      kind: "sponsor",
      assets: [
        { artworkId: "55555555-5555-4555-8555-555555555555", label: "Gas", sponsorName: "Gas", printWidthMm: 180 },
        { artworkId: "77777777-7777-4777-8777-777777777777", label: "Oil", sponsorName: "Oil", printWidthMm: null },
      ],
    });
    expect(count).toBe(2);
    expect(calls[0]!.args).toMatchObject({ p_kind: "sponsor" });
  });

  it("passes the database functions' own plain sentences through", async () => {
    for (const code of ["22023", "P0001"]) {
      const { client } = fake({ brand_studio_save_palette: { error: { message: "A palette holds up to 24 colours.", code } } });
      await expect(savePalette(client, WHO, { paletteId: null, name: "x", colours: [] })).rejects.toMatchObject({
        code: "invalid_input",
        message: "A palette holds up to 24 colours.",
      });
    }
  });

  it("says a name is taken, and never repeats a constraint's own words at a person", async () => {
    const taken = fake({ brand_studio_save_palette: { error: { message: 'duplicate key value violates unique constraint "brand_palettes_brand_id_name_key"', code: "23505" } } });
    await expect(savePalette(taken.client, WHO, { paletteId: null, name: "Primary", colours: [] })).rejects.toMatchObject({
      code: "invalid_input",
      message: "You already have one of those with that name.",
    });
    for (const code of ["23514", "22P02", "23502"]) {
      const { client } = fake({ brand_studio_save_palette: { error: { message: 'violates check constraint "brand_colours_hex_check"', code } } });
      const refused = savePalette(client, WHO, { paletteId: null, name: "x", colours: [] });
      await expect(refused).rejects.toMatchObject({ code: "invalid_input" });
      await expect(refused).rejects.not.toMatchObject({ message: expect.stringContaining("brand_colours_hex_check") });
    }
  });

  it("turns any other failure into one answer, and never leaks the database's words", async () => {
    const { client } = fake({ brand_studio_save_profile: { error: { message: "relation does not exist" } } });
    await expect(
      saveProfile(client, WHO, { category: "gym", website: null, about: "", voiceTags: [], setting: "", artDirection: "", rulesBoundaries: "", defaultSizeRange: [] }),
    ).rejects.toMatchObject({ code: "internal", message: "Your brand could not be saved." });
  });
});
