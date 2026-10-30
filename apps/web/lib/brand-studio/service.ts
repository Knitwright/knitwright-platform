/**
 * Brand Studio in the database (spec F-S9, decision 0079). Reads go through the member's own
 * client, so row level security decides what they see. Writes go through the server's client and
 * the `brand_studio_*` functions, which check the person's role themselves; the brand and the
 * person always come from the session.
 *
 * `club_kits` is read here and never written here: see `club-kit.ts` for why.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { clubKitAssets, clubKitPalette, type ClubKitFacts } from "./club-kit";
import { artworkRow, assetRow, fontRow, kitFontRow, paletteRow, profileRow, type AssetsBody, type FontsBody, type PaletteBody, type ProfileBody } from "./schemas";
import { EMPTY_PROFILE, type ArtworkFacts, type BrandAsset, type BrandPalette, type BrandProfile, type BrandRecord, type FontChoice, type KitFont } from "./types";
import { kindOf, VOICE_TAGS } from "./words";

const NOT_FOUND = "That brand does not exist.";
const UPLOADS_SHOWN = 200;

export type Who = Readonly<{ brandId: string; userId: string }>;

const fail = (error: { message: string; code?: string } | null): void => {
  if (!error) return;
  if (error.code === "42501") throw new AppError("forbidden", "You may not change this brand.");
  if (error.code === "P0002") throw new AppError("not_found", NOT_FOUND);
  throw new AppError("internal", "Your brand could not be saved.", undefined, { cause: error });
};

const read = <T>(schema: z.ZodType<T>, rows: unknown): readonly T[] => {
  const parsed = z.array(schema).safeParse(rows ?? []);
  return parsed.success ? parsed.data : [];
};

const numberOrNull = (value: number | string | null): number | null =>
  value === null ? null : typeof value === "number" ? value : Number.parseFloat(value);

/** The brand's details and visual style. A brand that has saved none reads as the empty profile. */
export async function getProfile(client: SupabaseClient, brandId: string): Promise<BrandProfile> {
  const { data, error } = await client
    .from("brand_profiles")
    .select("category, kind, website, about, voice_tags, setting, art_direction, rules_boundaries, default_size_range")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw new AppError("internal", "Your brand could not be read.", undefined, { cause: error });
  const row = profileRow.safeParse(data);
  if (!row.success) return EMPTY_PROFILE;
  return {
    kind: row.data.kind,
    category: row.data.category,
    website: row.data.website,
    about: row.data.about,
    voiceTags: VOICE_TAGS.filter((tag) => row.data.voice_tags.includes(tag)),
    style: { setting: row.data.setting, artDirection: row.data.art_direction, rulesBoundaries: row.data.rules_boundaries },
    defaultSizeRange: row.data.default_size_range,
  };
}

/** The brand's own palettes, in the order it put them in. */
export async function listPalettes(client: SupabaseClient, brandId: string): Promise<readonly BrandPalette[]> {
  const { data, error } = await client
    .from("brand_palettes")
    .select("id, name, brand_colours(id, name, hex, pantone_tcx, position)")
    .eq("brand_id", brandId)
    .order("position", { ascending: true });
  if (error) throw new AppError("internal", "Your palettes could not be read.", undefined, { cause: error });
  return read(paletteRow, data).map((row) => ({
    id: row.id,
    name: row.name,
    source: "brand-studio" as const,
    colours: [...row.brand_colours]
      .sort((a, b) => a.position - b.position)
      .map((colour) => ({ id: colour.id, name: colour.name, hex: colour.hex, pantoneTcx: colour.pantone_tcx })),
  }));
}

export async function listFonts(client: SupabaseClient, brandId: string): Promise<readonly FontChoice[]> {
  const { data, error } = await client.from("brand_fonts").select("role, font_key").eq("brand_id", brandId);
  if (error) throw new AppError("internal", "Your fonts could not be read.", undefined, { cause: error });
  return read(fontRow, data).map((row) => ({ role: row.role, fontKey: row.font_key }));
}

export async function listAssets(client: SupabaseClient, brandId: string): Promise<readonly BrandAsset[]> {
  const { data, error } = await client
    .from("brand_assets")
    .select("id, kind, artwork_id, label, sponsor_name, print_width_mm, position")
    .eq("brand_id", brandId)
    .order("kind", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new AppError("internal", "Your brand's pictures could not be read.", undefined, { cause: error });
  return read(assetRow, data).map((row) => ({
    id: row.id,
    kind: row.kind,
    artworkId: row.artwork_id,
    label: row.label,
    sponsorName: row.sponsor_name,
    printWidthMm: numberOrNull(row.print_width_mm),
    source: "brand-studio" as const,
  }));
}

/** The licensed kit-font list, as the platform holds it. A font with no licence on file is not selectable. */
export async function listKitFonts(client: SupabaseClient): Promise<readonly KitFont[]> {
  const { data, error } = await client
    .from("brand_studio_fonts")
    .select("key, label, family, licence, licence_note, selectable")
    .order("position", { ascending: true });
  if (error) throw new AppError("internal", "The font list could not be read.", undefined, { cause: error });
  return read(kitFontRow, data).map((row) => ({
    key: row.key,
    label: row.label,
    family: row.family,
    licence: row.licence,
    licenceNote: row.licence_note,
    selectable: row.selectable,
  }));
}

/** The brand's own uploads, for the picture pickers and the DPI check. Newest first. */
export async function listUploads(client: SupabaseClient, brandId: string): Promise<readonly ArtworkFacts[]> {
  const { data, error } = await client
    .from("user_artworks")
    .select("id, label, kind, width_px, height_px")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(UPLOADS_SHOWN);
  if (error) throw new AppError("internal", "Your uploads could not be read.", undefined, { cause: error });
  return read(artworkRow, data).map((row) => ({
    artworkId: row.id,
    label: row.label,
    kind: row.kind,
    widthPx: row.width_px,
    heightPx: row.height_px,
  }));
}

/** The club kit, read through. Nothing here is ever written: `/club` owns it (decision 0042). */
export async function getClubKit(client: SupabaseClient, brandId: string): Promise<ClubKitFacts> {
  const { data } = await client
    .from("club_kits")
    .select("primary_colour, secondary_colour, accent_colour, crest_file_id, sponsors")
    .eq("brand_id", brandId)
    .maybeSingle();
  const row = z
    .object({
      primary_colour: z.string().nullable(),
      secondary_colour: z.string().nullable(),
      accent_colour: z.string().nullable(),
      crest_file_id: z.string().nullable(),
      sponsors: z.array(z.object({ name: z.string(), logoFileId: z.string().nullable() })).catch([]),
    })
    .safeParse(data);
  if (!row.success) return { primaryColour: null, secondaryColour: null, accentColour: null, crestFileId: null, sponsors: [] };
  return {
    primaryColour: row.data.primary_colour,
    secondaryColour: row.data.secondary_colour,
    accentColour: row.data.accent_colour,
    crestFileId: row.data.crest_file_id,
    sponsors: row.data.sponsors,
  };
}

/** Everything the brand page shows, with the club kit read through after the brand's own rows. */
export async function loadBrand(
  client: SupabaseClient,
  brand: Readonly<{ id: string; name: string }>,
): Promise<Readonly<{ record: BrandRecord; kitFonts: readonly KitFont[]; uploads: readonly ArtworkFacts[] }>> {
  const [profile, palettes, fonts, assets, kitFonts, uploads, clubKit] = await Promise.all([
    getProfile(client, brand.id),
    listPalettes(client, brand.id),
    listFonts(client, brand.id),
    listAssets(client, brand.id),
    listKitFonts(client),
    listUploads(client, brand.id),
    getClubKit(client, brand.id),
  ]);
  const readThrough = clubKitPalette(clubKit);
  return {
    record: {
      brandId: brand.id,
      brandName: brand.name,
      profile,
      palettes: [...palettes, ...(readThrough === null ? [] : [readThrough])],
      fonts,
      assets: [...assets, ...clubKitAssets(clubKit)],
    },
    kitFonts,
    uploads,
  };
}

/**
 * What the completion % needs, and no more: the top bar shows the pill on every studio page, so it
 * does not ask for the font list or the uploads.
 */
export async function loadRecord(client: SupabaseClient, brand: Readonly<{ id: string; name: string }>): Promise<BrandRecord> {
  const [profile, palettes, fonts, assets, clubKit] = await Promise.all([
    getProfile(client, brand.id),
    listPalettes(client, brand.id),
    listFonts(client, brand.id),
    listAssets(client, brand.id),
    getClubKit(client, brand.id),
  ]);
  const readThrough = clubKitPalette(clubKit);
  return {
    brandId: brand.id,
    brandName: brand.name,
    profile,
    palettes: [...palettes, ...(readThrough === null ? [] : [readThrough])],
    fonts,
    assets: [...assets, ...clubKitAssets(clubKit)],
  };
}

export async function saveProfile(admin: SupabaseClient, who: Who, body: ProfileBody): Promise<void> {
  const { error } = await admin.rpc("brand_studio_save_profile", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_profile: { ...body, kind: kindOf(body.category) },
  });
  fail(error);
}

export async function savePalette(admin: SupabaseClient, who: Who, body: PaletteBody): Promise<string> {
  const { data, error } = await admin.rpc("brand_studio_save_palette", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_palette_id: body.paletteId,
    p_name: body.name,
    p_colours: body.colours,
  });
  fail(error);
  return z.string().parse(data);
}

export async function deletePalette(admin: SupabaseClient, who: Who, paletteId: string): Promise<void> {
  const { error } = await admin.rpc("brand_studio_delete_palette", { p_brand_id: who.brandId, p_user_id: who.userId, p_palette_id: paletteId });
  fail(error);
}

export async function saveFonts(admin: SupabaseClient, who: Who, body: FontsBody): Promise<void> {
  const { error } = await admin.rpc("brand_studio_save_fonts", { p_brand_id: who.brandId, p_user_id: who.userId, p_fonts: body.fonts });
  fail(error);
}

export async function saveAssets(admin: SupabaseClient, who: Who, body: AssetsBody): Promise<number> {
  const { data, error } = await admin.rpc("brand_studio_save_assets", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_kind: body.kind,
    p_assets: body.assets,
  });
  fail(error);
  return z.number().parse(data);
}
