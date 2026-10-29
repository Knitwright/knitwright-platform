# 03 · Data model

Postgres is the single source of truth. Relational tables hold accounts, catalogue, orders and operations. The design itself is a versioned JSON document (`design_version.doc`) validated against `schemas/design-object.schema.json`. The DDL is in `schemas/schema.sql`; this page explains it.

## Entity map

```
workspace ─┬─ membership ── user
           ├─ brand (Brand Studio: palettes, fonts by role, logos, graphics, visual style, voice)
           ├─ design ── design_version (doc JSON) ──┬─ validation_result
           │                                       ├─ package_export ── file_artifact
           │                                       ├─ techpack_field (provenance, rule_id)
           │                                       ├─ shoot_job ── media_set ── file_artifact
           │                                       └─ golden_sample
           ├─ moodboard ── inspiration_item (source, link, attribution)
           ├─ pinterest_connection (OAuth tokens, chosen boards)
           ├─ benchmark ── benchmark_item
           ├─ roster ── roster_entry
           ├─ team_store / storefront ── listing ── listing_variant
           └─ customer_order ── order_line ── personalisation
                         │
base_article ── article_size ── panel_geometry          batch ── batch_line (→ order_line)
     │      └── parameter_def / option_def                │
     └── factory_capability ── price_tier                 ├─ job_packet (magic link) ── factory_event
factory ─┘          fabric ── fabric_colour               ├─ qc_record ── qc_measurement
country_rule (duty, VAT, de minimis, label rules)         └─ shipment ── parcel
rulebook_entry (versioned knowledge base) · shoot_concept ── shoot_pose · model_preset
moderation_check · payment · payout · audit_log
```

## Core entities

| Entity | Purpose | Key fields |
|---|---|---|
| `workspace` | Club or brand account; owns everything | `kind` (club, brand), `name`, `slug` (subdomain), `country`, `custom_domain` |
| `membership` | User × workspace role | `role` (admin, manager, viewer) |
| `base_article` | A makeable garment block | `code` (e.g. `JSY-SS-01`), `class` (A, B), `sport_tags[]`, `glb_model_key`, `uv_panel_map`, `size_range[]`, `pom_table` (per size, with tolerances), `parametric_script` (module id + version) |
| `parameter_def` | Factory-approved structural range | `article_id`, `key` (e.g. `inseam_in`), `type` (range, enum, bool), `min`, `max`, `step`, `default`, `affects_panels[]`, `approved_by_sample_id` |
| `option_def` | Discrete structural options (collar, sleeve) | `article_id`, `group`, `value`, `thumbnail_key`, `extra_cost` |
| `panel_geometry` | Pre-computed geometry per article × size at default parameters (cache) | `outline` (mm polyline), `seam_allowance_mm`, `notches[]`, `grainline`, `print_box_mm`, `uv_rect` |
| `fabric` | Fabric programme entry | `code`, `blend`, `gsm`, `stretch`, `finish`, `pfas_free`, `oeko_tex_cert`, `sublimatable`, `swatch_ref` |
| `fabric_colour` | Stock colours for Class B | `fabric_id`, `name`, `hex`, `lab`, `pantone` |
| `factory` | Partner factory | `name`, `city`, `contact_whatsapp`, `certifications[]` (with expiry and document), `status` |
| `factory_capability` | Factory × article × fabric | `lead_time_days`, `moq`, `weekly_slot_capacity` (Class A), `file_formats_accepted[]`, `golden_sample_status`, `colour_delta_max` |
| `price_tier` | Cost and sell ladders | `capability_id`, `qty_min`, `qty_max`, `cost_usd`, `sell_gbp`, `sell_aud`, `personalisation_cost` |
| `country_rule` | Market rules as data, not code | `country`, `vat_rate`, `low_value_threshold`, `duty_rate_by_hs`, `preference_scheme`, `label_rules`, `selling_enabled` |
| `design` | A product being designed | `workspace_id`, `base_article_id`, `title`, `current_version_id` |
| `design_version` | Immutable snapshot | `doc` (JSONB, the design object), `parent_version_id`, `status` (draft, validated, approved, ordered), `hash` |
| `validation_result` | Output of `validate()` | `version_id`, `factory_id`, `checks[]` (code, severity, message, target), `passed` |
| `benchmark` / `benchmark_item` | Research cards | `source_url`, `fetched_at`, `fields` (JSONB with `value` and `provenance`: observed, inferred, unknown, user_confirmed), `complaint_themes[]` |
| `golden_sample` | Approved physical reference | `version_id`, `factory_id`, `photos[]`, `measured_pom` (JSONB), `delta_e[]`, `approved_by`, `approved_at` |
| `roster` / `roster_entry` | Players per season | `season`, `name_on_shirt`, `number`, `size`, `email`, `status` |
| `team_store` | Club store | `design_version_ids[]`, `opens_at`, `closes_at`, `min_pieces`, `club_margin_pct`, `delivery_mode` (one address, split) |
| `storefront` / `listing` | Brand store and products | `mode` (drop, mto, stocked), `retail_price`, `drop_opens_at`, `drop_closes_at`, `target_qty` |
| `customer_order` / `order_line` | What was bought (`order` is a reserved word in SQL) | `source` (teamwear, team_store, storefront, shopify, sample, run), `version_id`, `size`, `qty`, `unit_sell`, `unit_cost_snapshot`, `promised_date` |
| `personalisation` | Name and number per line | `name`, `number`, `roster_entry_id` |
| `batch` / `batch_line` | Weekly or per-run production unit | `factory_id`, `class`, `cutoff_at`, `status`, `due_at` |
| `job_packet` | Magic-link page for the factory | `batch_id`, `token_hash`, `expires_at`, `revoked` |
| `factory_event` | Status updates and photos from factory | `type`, `note`, `photo_keys[]`, `at` |
| `qc_record` / `qc_measurement` | QC per order or batch | `aql_level`, `sample_size`, `pom_point`, `measured_mm`, `tolerance_mm`, `pass`, `delta_e` |
| `shipment` / `parcel` | Courier and freight | `carrier`, `tracking`, `hs_codes`, `invoice_key`, `origin_proof_key` |
| `package_export` / `media_set` / `file_artifact` | Generated files in R2 | `kind`, `r2_key`, `sha256`, `bytes`, `generated_from_version_hash` |
| `moderation_check` | IP and content screening | `target` (asset, text, version), `result` (clear, flagged, blocked), `reasons[]`, `reviewer_id` |
| `payment` / `payout` | Stripe records | `stripe_ids`, `amount`, `currency`, `status`; payouts reference delivered `order_line`s |
| `audit_log` | Every state change | `actor`, `entity`, `before`, `after`, `at` |
| `moodboard` / `inspiration_item` | Saved inspiration per design or collection | `source` (library, pinterest, unsplash, pexels, link_preview, user_upload, ai_mood), `source_url`, `preview_url`, `attribution`, `tags[]`, `suggestion_ids[]`; third-party images are referenced, not stored |
| `pinterest_connection` | User's Pinterest OAuth link | `user_id`, encrypted tokens, `board_ids[]`, `scopes`, `expires_at` |
| `suggestion` | A manufacturable suggestion derived from inspiration | `version_id`, `from_inspiration_id`, `design_patch` (JSON Patch), `explanation`, `validated`, `applied_version_id` |
| `rulebook_entry` | Knowledge base behind every "Why?" | `rule_id` (e.g. `R-SUB-004`), `topic` (construction, fabric, print, fit, labels, cost), `article_codes[]`, `title`, `body`, `best_practice`, `source` (factory, pattern master, standard), `version`, `approved_by` |
| `techpack_field` | One tech-pack value with provenance | `version_id`, `section` (overview, construction, bom, pom, graphics, labels, colourway), `key`, `value`, `provenance` (from_base, from_design, needs_input, confirmed), `rule_id` |
| `shoot_concept` / `shoot_pose` / `model_preset` | Shoot ideas library | concept: `name`, `sports[]`, `articles[]`, `scene`, `lighting`, `camera`, `output_set`; pose: `name`, `reference_key`; model preset: `label`, `attributes`, `licence_ref` (AI-generated only) |
| `shoot_job` | One generation run | `version_id`, `concept_id` or custom inputs, `garment_source` (render, golden_sample_photo), `model` (preset id or user upload with `consent_confirmed`), `background`, `pose`, `outputs` → `media_set`, `checker_scores[]`, `credits` |
| `brand` | Brand Studio record per workspace (F-S9) | `name`, `category`, `website`, `about`, `palettes` (named, each colour with hex/Pantone/sublimation-safe match), `fonts` (role → licensed font + weight: headline, subheadline, body, accent, name_number), `logos[]`, `graphics[]`, `visual_style` {setting, art_direction, rules}, `voice_tags[]`, `completion_pct`, `imported_from_url` |
| `template` | Any template in `07-template-library.md` | `kind` (design, kit_bundle, mockup_scene, marketing, video, flow, techpack), `sport_tags[]`, `article_codes[]`, `style_tags[]`, `mood`, `colour_family`, `payload` (JSON per kind), `thumbnail_key`, `status`, `likes`, `uses` |
| `project` / `board` / `board_edge` | Launch canvas and Flows (F-L1–F-L4) | project: `workspace_id`, `name`, `units` (px/in/mm), `from_template_id`; board: `kind` (design, artboard, mockup, ai_image, ai_video, marketing, info_card), `position`, `size`, `settings` (prompt, model, aspect, style, duration, preset), `input_version_id`, `output_artifact_id`, `status`, `last_cost`; edge: `from_board_id`, `to_board_id`, `input_index` ("image 1/2") |
| `flow_run` | One "Run all" or Regenerate execution | `project_id`, `board_ids[]`, `estimated_credits`, `spent_credits`, `refunded_credits`, `status`, per-board results |
| `collection_plan` / `plan_group` / `plan_style` | Collection board and line plan (F-S10) | plan: `name`, `season`; group: `name`, frame position; style: `design_id`, `colourways[]`, `sizes[]`, `qty`, `split_wholesale_pct`, `wholesale_price`, `rrp`, `status` (draft, sampling, approved, ordered); unit cost is computed live from `price_tier` |
| `credit_ledger` | Credits for AI scenes, video, copy | `workspace_id`, `delta`, `reason` (plan grant, top-up, generation, refund), `ref` (board, shoot_job), `at` |

## The design object

The full JSON Schema is `schemas/design-object.schema.json`. Shape:

```json
{
  "schema_version": "2.0",
  "article": { "base_article_code": "SHO-TR-01", "class": "A",
               "parameters": { "inseam_in": 5, "waistband": "elastic_drawcord", "side_split": true },
               "options": { "pocket": "zip_back" },
               "fabric": { "code": "F-POLY-INT", "colour": null } },
  "colourway": { "name": "Home", "colours": [ { "role": "primary", "hex": "#0B1F4B", "pantone": "19-4024 TCX" } ] },
  "panels": [
    { "panel_id": "front_left", "layers": [
        { "type": "fill", "colour_role": "primary" },
        { "type": "pattern", "pattern_id": "diag-stripe-04", "colours": ["secondary"], "scale": 1.0, "rotation_deg": 45 },
        { "type": "artwork", "asset_id": "crest", "x_mm": 0, "y_mm": 40, "width_mm": 70, "scale_by_size": "grade" } ] }
  ],
  "assets": [ { "asset_id": "crest", "kind": "crest", "file_key": "r2://...", "vector": true, "moderation": "clear" } ],
  "name_number": { "enabled": true, "font_id": "kw-block-01", "colour_role": "accent",
                   "zones": [ { "panel_id": "back", "kind": "name", "y_mm": 60 }, { "panel_id": "back", "kind": "number", "y_mm": 110, "height_mm": 200 } ] },
  "labels": { "care": "auto", "size": "auto", "brand_label_asset_id": null, "packaging": "polybag_std" },
  "provenance": { "benchmark_ids": ["..."], "intake": "template", "ai_assisted": true }
}
```

**Rules**
- Positions are stored in millimetres on the size-M panel. Other sizes are derived by grading: `scale_by_size` is `grade` (scale with the panel), `fixed` (same size, e.g. sponsor logos) or `anchor` (same offset from an anchor point).
- Colours are stored by role. A colourway maps roles to values, so variants are cheap.
- Parameters must sit inside `parameter_def` ranges; validation enforces it.
- The document never contains generated pixels on garment panels. Generated imagery lives only in `media_set`.

## Factory profile (read model)

Validation and pricing read a denormalised **factory profile** built from `factory`, `factory_capability`, `price_tier`, `fabric` and `parameter_def`, cached per factory and invalidated on change. `validate(version, profile)` is a pure function in the files service (Python), with a TypeScript mirror for instant UI feedback. A golden test suite keeps the two implementations identical.

## Conventions

- IDs: UUIDv7. Money: integer minor units plus currency. Lengths: millimetres as numeric (inches only for display).
- Every table has `created_at`, `updated_at` and soft delete where user-facing.
- Row-level security by `workspace_id` for all customer data. Ops roles bypass it through a separate service role.
- PII (player names, emails) is limited to roster and order tables. Rosters older than 2 seasons are purged unless the club opts in.
