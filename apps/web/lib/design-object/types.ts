/**
 * The spec's design object, version 2.0 (docs/spec/schemas/design-object.schema.json), as TypeScript. It is an export
 * format for techpack.json and interop (plan v5 owner decision 4), never the stored shape: the platform stores
 * `GarmentSpec`, and `toDesignObjectV2` makes this from it.
 */

import type { ArticleRef } from "@/lib/garment/spec-schema";

export interface DoColour {
  readonly role: string;
  readonly hex: string;
  readonly pantone?: string;
}

export interface DoLayer {
  readonly type: "fill" | "gradient" | "pattern" | "artwork" | "text";
  readonly colour_role?: string;
  readonly colours?: readonly string[];
  readonly pattern_id?: string;
  readonly asset_id?: string;
  readonly text?: string;
  readonly font_id?: string;
  readonly x_mm?: number;
  readonly y_mm?: number;
  readonly width_mm?: number;
  readonly rotation_deg?: number;
  readonly scale?: number;
  readonly scale_by_size?: "grade" | "fixed" | "anchor";
  readonly anchor?: string;
}

export interface DoAsset {
  readonly asset_id: string;
  readonly kind: "crest" | "logo" | "sponsor" | "artwork" | "label";
  readonly file_key: string;
  readonly moderation: "pending" | "clear" | "flagged" | "blocked";
}

export interface DoZone {
  readonly panel_id: string;
  readonly kind: "name" | "number" | "front_number" | "sleeve_number";
  readonly height_mm?: number;
}

export interface DesignObjectV2 {
  readonly schema_version: "2.0";
  readonly article: {
    readonly base_article_code: string;
    readonly class: "A" | "B";
    readonly parameters: Readonly<Record<string, number | string | boolean>>;
    readonly options: Readonly<Record<string, string>>;
    readonly fabric: { readonly code: string; readonly colour: string | null };
  };
  readonly colourway: { readonly name: string; readonly colours: readonly DoColour[] };
  readonly panels: readonly { readonly panel_id: string; readonly layers: readonly DoLayer[] }[];
  readonly assets: readonly DoAsset[];
  readonly name_number: { readonly enabled: boolean; readonly font_id?: string; readonly colour_role?: string; readonly zones: readonly DoZone[] };
  readonly labels: { readonly care: "auto" | "custom"; readonly size: "auto"; readonly brand_label_asset_id: null };
  readonly provenance: { readonly ai_assisted: boolean };
}

export type ExportResult = { readonly ok: true; readonly object: DesignObjectV2 } | { readonly ok: false; readonly reason: string };

/**
 * What the export reads that the stored design does not hold. Each comes from a workstream built beside this one
 * (plan v5 Lessons 9): the base article from `lib/validation` `articleOf` (the catalogue, X1), the fabric's catalogue
 * code from the catalogue too, and the moderation results from moderation (X8). A missing value is never guessed:
 * no article refuses the export, an unknown fabric code falls back to the design's own fabric id, and an asset with
 * no moderation result is `pending`.
 */
export interface ExportContext {
  readonly article: ArticleRef | null;
  readonly fabricCode?: string | null;
  readonly moderation?: ReadonlyMap<string, DoAsset["moderation"]>;
}
