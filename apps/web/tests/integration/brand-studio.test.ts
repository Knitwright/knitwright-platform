import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Brand Studio (spec F-S9, plan v5 Y6, decision 0079) against local Supabase. Needs `pnpm db:start`.
 * Two brands are used throughout to show nothing leaks between them.
 *
 * A person may belong to at most 3 brands, so every brand here gets its own person.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

/** Invites someone and has them accept, so they hold a role in the brand (decision 0042). */
const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((invitation) => invitation.brand_id === brandId);
  expect(mine).toBeDefined();
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

/** One of the brand's own uploads, made the way `lib/artwork-intake` makes one. */
const upload = async (brandId: string, ownerId: string, label: string): Promise<string> => {
  const fileId = randomUUID();
  must(
    await adminClient().from("files").insert({
      id: fileId,
      brand_id: brandId,
      bucket: "uploads",
      path: `${brandId}/artwork/${randomUUID()}.png`,
      kind: "artwork",
      content_type: "image/png",
      bytes: 10,
      created_by: ownerId,
    }),
  );
  const row = must(
    await adminClient()
      .from("user_artworks")
      .insert({
        brand_id: brandId,
        kind: "raster",
        source_format: "png",
        label,
        source_sha256: "a".repeat(64),
        print_sha256: "b".repeat(64),
        print_file_id: fileId,
        screen_file_id: fileId,
        width_px: 600,
        height_px: 600,
        colour_space: "srgb",
        has_alpha: true,
        rights_confirmed_by: ownerId,
        rights_confirmed_at: "2026-10-14T00:00:00Z",
        rights_wording_version: "logo-rights-v1",
        created_by: ownerId,
      })
      .select("id")
      .single(),
  ) as { id: string };
  return row.id;
};

const PROFILE = {
  category: "club",
  website: "https://example.test",
  about: "A club in the north.",
  voiceTags: ["community", "gritty"],
  setting: "A wet pitch at dusk.",
  artDirection: "Long lens, low light.",
  rulesBoundaries: "Never a sponsor on the sleeve.",
  defaultSizeRange: ["S", "M", "L"],
};

let ann: Person;
let ben: Person;
let manager: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben, manager, viewer] = await Promise.all([person("bs-ann"), person("bs-ben"), person("bs-manager"), person("bs-viewer")]);
  annBrand = await brandOf(ann, `Ann Athletic ${randomUUID().slice(0, 8)}`);
  benBrand = await brandOf(ben, `Ben Boots ${randomUUID().slice(0, 8)}`);
  await join(ann, annBrand, manager, "kit_manager");
  await join(ann, annBrand, viewer, "viewer");
});

describe("the licensed kit-font list", () => {
  it("offers a font only when its licence is on file, and labels the rest", async () => {
    const rows = must(await ann.client.from("brand_studio_fonts").select("key, licence, selectable, licence_note").order("position")) as {
      key: string;
      licence: string;
      selectable: boolean;
      licence_note: string;
    }[];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.filter((row) => row.selectable).map((row) => row.key)).toEqual(["geist", "geist-mono"]);
    for (const row of rows) {
      expect(row.selectable).toBe(row.licence === "bundled");
      expect(row.licence_note.length).toBeGreaterThan(10);
      if (!row.selectable) expect(row.licence_note).toContain("No licence");
    }
  });

  it("lets a signed-in person read it and a visitor read nothing", async () => {
    expect((must(await ann.client.from("brand_studio_fonts").select("key")) as unknown[]).length).toBeGreaterThan(1);
    const { data, error } = await anonClient().from("brand_studio_fonts").select("key");
    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("refuses a font whose licence is not on file, from any role", async () => {
    const refused = await rpc("brand_studio_save_fonts", {
      p_brand_id: annBrand,
      p_user_id: ann.userId,
      p_fonts: [{ role: "headline", fontKey: "placeholder-block" }],
    });
    expect(refused.error?.hint).toBe("font_not_licensed");
  });

  it("refuses a font key that does not exist at all", async () => {
    const refused = await rpc("brand_studio_save_fonts", { p_brand_id: annBrand, p_user_id: ann.userId, p_fonts: [{ role: "body", fontKey: "mystery" }] });
    expect(refused.error).not.toBeNull();
  });
});

describe("the brand record", () => {
  it("is saved by an owner and read back whole", async () => {
    must(await rpc("brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: ann.userId, p_profile: PROFILE }));
    const row = must(await ann.client.from("brand_profiles").select("*").eq("brand_id", annBrand).single()) as Record<string, unknown>;
    expect(row).toMatchObject({
      category: "club",
      kind: "club",
      website: "https://example.test",
      about: "A club in the north.",
      setting: "A wet pitch at dusk.",
      updated_by: ann.userId,
    });
    expect(row.voice_tags).toEqual(["community", "gritty"]);
    expect(row.default_size_range).toEqual(["S", "M", "L"]);
  });

  it("works the kind out from the category, so the two can never disagree", async () => {
    for (const [category, kind] of [["sportswear_brand", "brand"], ["school", "club"], ["esports_team", "brand"]] as const) {
      must(await rpc("brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: ann.userId, p_profile: { ...PROFILE, category } }));
      const row = must(await ann.client.from("brand_profiles").select("kind").eq("brand_id", annBrand).single()) as { kind: string };
      expect(row.kind).toBe(kind);
    }
    must(await rpc("brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: ann.userId, p_profile: PROFILE }));
  });

  it("lets a kit manager save it and refuses a viewer", async () => {
    must(await rpc("brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: manager.userId, p_profile: PROFILE }));
    const refused = await rpc("brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: viewer.userId, p_profile: PROFILE });
    expect(refused.error?.code).toBe("42501");
  });

  it("refuses a category, a website, an About and a size label the rules do not allow", async () => {
    const bad = [
      { ...PROFILE, category: "spaceship" },
      { ...PROFILE, website: "example.test" },
      { ...PROFILE, about: "a".repeat(1001) },
      { ...PROFILE, voiceTags: ["angry"] },
      { ...PROFILE, defaultSizeRange: ["<script>"] },
    ];
    for (const profile of bad) {
      const refused = await rpc("brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: ann.userId, p_profile: profile });
      expect(refused.error).not.toBeNull();
    }
  });

  it("is invisible to another brand", async () => {
    expect(must(await ben.client.from("brand_profiles").select("about").eq("brand_id", annBrand))).toEqual([]);
  });

  it("lets nobody write it from a browser", async () => {
    await ann.client.from("brand_profiles").update({ about: "Changed from a browser" }).eq("brand_id", annBrand);
    const row = must(await adminClient().from("brand_profiles").select("about").eq("brand_id", annBrand).single()) as { about: string };
    expect(row.about).toBe("A club in the north.");
  });
});

describe("palettes and colours", () => {
  it("saves a palette with its colours and gives back its id", async () => {
    const id = must(
      await rpc("brand_studio_save_palette", {
        p_brand_id: annBrand,
        p_user_id: ann.userId,
        p_palette_id: null,
        p_name: "Primary",
        p_colours: [
          { name: "Club red", hex: "#C8102E", pantoneTcx: " 19-1664 TCX " },
          { name: "White", hex: "#ffffff", pantoneTcx: "" },
        ],
      }),
    ) as string;
    const colours = must(
      await ann.client.from("brand_colours").select("name, hex, pantone_tcx, position").eq("palette_id", id).order("position"),
    ) as { name: string; hex: string; pantone_tcx: string | null; position: number }[];
    expect(colours).toEqual([
      { name: "Club red", hex: "#c8102e", pantone_tcx: "19-1664 TCX", position: 1 },
      { name: "White", hex: "#ffffff", pantone_tcx: null, position: 2 },
    ]);
  });

  it("replaces the colours of a palette rather than adding to them", async () => {
    const id = must(
      await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: `Away ${randomUUID().slice(0, 8)}`, p_colours: [{ name: "A", hex: "#000000" }] }),
    ) as string;
    must(await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: id, p_name: "Away kit", p_colours: [{ name: "B", hex: "#ffffff" }] }));
    const colours = must(await ann.client.from("brand_colours").select("name").eq("palette_id", id)) as { name: string }[];
    expect(colours).toEqual([{ name: "B" }]);
  });

  it("refuses a colour that is not a colour, and more colours than a palette holds", async () => {
    const notAColour = await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: "Bad", p_colours: [{ name: "x", hex: "navy" }] });
    expect(notAColour.error).not.toBeNull();
    const tooMany = await rpc("brand_studio_save_palette", {
      p_brand_id: annBrand,
      p_user_id: ann.userId,
      p_palette_id: null,
      p_name: "Bad",
      p_colours: Array.from({ length: 25 }, () => ({ name: "x", hex: "#000000" })),
    });
    expect(tooMany.error?.hint).toBe("too_many_colours");
  });

  it("refuses another brand's palette, and shows it nothing", async () => {
    const id = must(
      await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: `Mine ${randomUUID().slice(0, 8)}`, p_colours: [] }),
    ) as string;
    const refused = await rpc("brand_studio_save_palette", { p_brand_id: benBrand, p_user_id: ben.userId, p_palette_id: id, p_name: "Theirs", p_colours: [] });
    expect(refused.error?.code).toBe("P0002");
    expect(must(await ben.client.from("brand_palettes").select("name").eq("id", id))).toEqual([]);
  });

  it("deletes a palette with its colours, and refuses one that is not there", async () => {
    const id = must(
      await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: `Gone ${randomUUID().slice(0, 8)}`, p_colours: [{ name: "x", hex: "#000000" }] }),
    ) as string;
    must(await rpc("brand_studio_delete_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: id }));
    expect(must(await adminClient().from("brand_colours").select("id").eq("palette_id", id))).toEqual([]);
    const again = await rpc("brand_studio_delete_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: id });
    expect(again.error?.code).toBe("P0002");
  });

  it("refuses a second palette with the same name", async () => {
    const name = `Twice ${randomUUID().slice(0, 8)}`;
    must(await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: name, p_colours: [] }));
    const refused = await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: name, p_colours: [] });
    expect(refused.error).not.toBeNull();
  });
});

describe("the brand's pictures", () => {
  it("takes one of the brand's own uploads and refuses another brand's", async () => {
    const mine = await upload(annBrand, ann.userId, "Ann crest");
    const theirs = await upload(benBrand, ben.userId, "Ben crest");
    expect(
      must(
        await rpc("brand_studio_save_assets", {
          p_brand_id: annBrand,
          p_user_id: ann.userId,
          p_kind: "crest",
          p_assets: [{ artworkId: mine, label: "Crest", printWidthMm: 90 }],
        }),
      ),
    ).toBe(1);
    const refused = await rpc("brand_studio_save_assets", {
      p_brand_id: annBrand,
      p_user_id: ann.userId,
      p_kind: "crest",
      p_assets: [{ artworkId: theirs, label: "Theirs", printWidthMm: null }],
    });
    expect(refused.error?.code).toBe("P0002");
  });

  it("keeps the print width, or no width at all when the brand has not said", async () => {
    const artwork = await upload(annBrand, ann.userId, "Sponsor");
    must(
      await rpc("brand_studio_save_assets", {
        p_brand_id: annBrand,
        p_user_id: ann.userId,
        p_kind: "sponsor",
        p_assets: [
          { artworkId: artwork, label: "Gas", sponsorName: "Northern Gas", printWidthMm: 180 },
          { artworkId: artwork, label: "Oil", sponsorName: "Oil", printWidthMm: null },
        ],
      }),
    );
    const rows = must(
      await ann.client.from("brand_assets").select("sponsor_name, print_width_mm, position").eq("brand_id", annBrand).eq("kind", "sponsor").order("position"),
    ) as { sponsor_name: string | null; print_width_mm: number | null; position: number }[];
    expect(rows.map((row) => [row.sponsor_name, row.print_width_mm])).toEqual([
      ["Northern Gas", 180],
      ["Oil", null],
    ]);
  });

  it("keeps a sponsor's name off every other kind", async () => {
    const artwork = await upload(annBrand, ann.userId, "Logo");
    must(await rpc("brand_studio_save_assets", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "logo", p_assets: [{ artworkId: artwork, label: "Mark", sponsorName: "Ignored" }] }));
    const rows = must(await ann.client.from("brand_assets").select("sponsor_name").eq("brand_id", annBrand).eq("kind", "logo")) as { sponsor_name: string | null }[];
    expect(rows).toEqual([{ sponsor_name: null }]);
  });

  it("refuses more pictures than a brand holds of that kind, and a kind it does not offer", async () => {
    const artwork = await upload(annBrand, ann.userId, "Crest again");
    const tooMany = await rpc("brand_studio_save_assets", {
      p_brand_id: annBrand,
      p_user_id: ann.userId,
      p_kind: "crest",
      p_assets: [{ artworkId: artwork, label: "One" }, { artworkId: artwork, label: "Two" }],
    });
    expect(tooMany.error?.hint).toBe("too_many_pictures");
    const odd = await rpc("brand_studio_save_assets", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "banner", p_assets: [] });
    expect(odd.error?.code).toBe("22023");
  });

  it("goes when its upload goes, so a brand never points at a picture that is not there", async () => {
    const artwork = await upload(annBrand, ann.userId, "Packaging");
    must(await rpc("brand_studio_save_assets", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "packaging", p_assets: [{ artworkId: artwork, label: "Box" }] }));
    must(await adminClient().from("user_artworks").delete().eq("id", artwork).select("id"));
    expect(must(await adminClient().from("brand_assets").select("id").eq("brand_id", annBrand).eq("kind", "packaging"))).toEqual([]);
  });

  it("refuses a viewer and shows another brand nothing", async () => {
    const artwork = await upload(annBrand, ann.userId, "Label");
    const refused = await rpc("brand_studio_save_assets", { p_brand_id: annBrand, p_user_id: viewer.userId, p_kind: "label", p_assets: [{ artworkId: artwork, label: "Care" }] });
    expect(refused.error?.code).toBe("42501");
    expect(must(await ben.client.from("brand_assets").select("label").eq("brand_id", annBrand))).toEqual([]);
  });
});

describe("the club kit it reads through", () => {
  it("is still the only place a club's colours and crest are stored", async () => {
    must(await rpc("save_club_kit", { p_brand_id: annBrand, p_user_id: ann.userId, p_kit: { primaryColour: "#0b3d91", accentColour: "#ffd100" } }));
    const kit = must(await ann.client.from("club_kits").select("primary_colour, accent_colour").eq("brand_id", annBrand).single()) as Record<string, string>;
    expect(kit).toEqual({ primary_colour: "#0b3d91", accent_colour: "#ffd100" });
    // Nothing in Brand Studio holds a copy of them: the brand page reads club_kits every time.
    const colours = must(await ann.client.from("brand_colours").select("hex").eq("brand_id", annBrand)) as { hex: string }[];
    expect(colours.map((colour) => colour.hex)).not.toContain("#ffd100");
  });

  it("keeps working after Brand Studio has saved its own palette", async () => {
    must(await rpc("brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: `Own ${randomUUID().slice(0, 8)}`, p_colours: [{ name: "Own", hex: "#123456" }] }));
    const kit = must(await ann.client.from("club_kits").select("primary_colour").eq("brand_id", annBrand).single()) as { primary_colour: string };
    expect(kit.primary_colour).toBe("#0b3d91");
  });
});

describe("what a browser may do", () => {
  it("cannot call the writing functions, and a visitor reads nothing", async () => {
    const calls: readonly [string, Record<string, unknown>][] = [
      ["brand_studio_save_profile", { p_brand_id: annBrand, p_user_id: ann.userId, p_profile: PROFILE }],
      ["brand_studio_save_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: null, p_name: "X", p_colours: [] }],
      ["brand_studio_delete_palette", { p_brand_id: annBrand, p_user_id: ann.userId, p_palette_id: randomUUID() }],
      ["brand_studio_save_fonts", { p_brand_id: annBrand, p_user_id: ann.userId, p_fonts: [] }],
      ["brand_studio_save_assets", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "logo", p_assets: [] }],
    ];
    for (const [name, args] of calls) {
      expect((await ann.client.rpc(name, args)).error).not.toBeNull();
      expect((await anonClient().rpc(name, args)).error).not.toBeNull();
    }
    for (const table of ["brand_profiles", "brand_palettes", "brand_colours", "brand_fonts", "brand_assets"]) {
      const { data, error } = await anonClient().from(table).select("brand_id");
      expect(error !== null || data?.length === 0, table).toBe(true);
    }
  });

  it("goes with the brand when the brand goes", async () => {
    const owner = await person("bs-doomed");
    const brandId = await brandOf(owner, `Doomed ${randomUUID().slice(0, 8)}`);
    must(await rpc("brand_studio_save_profile", { p_brand_id: brandId, p_user_id: owner.userId, p_profile: PROFILE }));
    must(await rpc("brand_studio_save_palette", { p_brand_id: brandId, p_user_id: owner.userId, p_palette_id: null, p_name: "Primary", p_colours: [{ name: "x", hex: "#000000" }] }));
    must(await adminClient().from("brands").delete().eq("id", brandId).select("id"));
    for (const table of ["brand_profiles", "brand_palettes", "brand_colours"]) {
      expect(must(await adminClient().from(table).select("brand_id").eq("brand_id", brandId))).toEqual([]);
    }
  });
});
