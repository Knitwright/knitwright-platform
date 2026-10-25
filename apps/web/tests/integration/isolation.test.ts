import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The isolation suite. Plan step 3, task 7, and acceptance criterion M5: one brand can
 * never read another brand's designs, files or images.
 *
 * The suite asks the database which tables, buckets and functions exist. A new one
 * that is not described below makes the suite fail, so nothing can be added without
 * deciding who may reach it.
 */

type Row = Record<string, unknown>;

type TableSpec = Readonly<{
  /** What a browser may do to the table at all, before any policy is considered. */
  privileges: readonly string[];
  /**
   * The column that says whose a row is: a brand's id, or for a table of one person's own rows
   * (`ownedBy: "user"`), that person's id.
   */
  brandColumn: string;
  /** Rows belong to one person rather than to a brand. The tests then use people's ids. */
  ownedBy?: "user";
  /** A row of the given brand, made by the server. Returns the columns that identify it. */
  seed: (brandId: string, ownerId: string) => Promise<Row>;
  /** A row someone might try to insert for the given brand (or person, when owned by a user). */
  attempt: (brandId: string, userId: string) => Row;
  /** A change someone might try to make. */
  change: Row;
}>;

/** An allowance no test will reach. */
const UNLIMITED = 1_000_000_000_000;

const filePath = (brandId: string) => `${brandId}/artwork/${randomUUID()}.png`;

const blockRow = (brandId: string, userId: string): Row => ({
  brand_id: brandId,
  product_key: "crew-tee",
  wearer: "men",
  cut: "mens",
  name: "Crew tee",
  kind: "pieces",
  version: 1,
  source: "technician-upload",
  sizes: ["M"],
  created_by: userId,
});

/** A block of the brand, made by the server. Each call is a new product key, so versions never clash. */
const seedBlock = async (brandId: string, ownerId: string): Promise<Row> =>
  must(
    await adminClient()
      .from("pattern_blocks")
      .insert({ ...blockRow(brandId, ownerId), product_key: `tee-${randomUUID().slice(0, 8)}` })
      .select("id")
      .single(),
  );

const TABLES: Readonly<Record<string, TableSpec>> = {
  brands: {
    privileges: ["SELECT"],
    brandColumn: "id",
    seed: async (brandId) => ({ id: brandId }),
    attempt: (_brandId, userId) => ({ name: "Made directly", created_by: userId }),
    change: { name: "Changed by a stranger" },
  },
  memberships: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ brand_id: brandId, user_id: ownerId }),
    attempt: (brandId, userId) => ({ brand_id: brandId, user_id: userId, role: "owner" }),
    change: { role: "owner" },
  },
  files: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const row = {
        id: randomUUID(),
        brand_id: brandId,
        bucket: "uploads",
        path: filePath(brandId),
        kind: "artwork",
        content_type: "image/png",
        bytes: 10,
        created_by: ownerId,
      };
      must(await adminClient().from("files").insert(row).select("id"));
      return { id: row.id };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      bucket: "uploads",
      path: filePath(brandId),
      kind: "artwork",
      content_type: "image/png",
      bytes: 10,
      created_by: userId,
    }),
    change: { kind: "photo" },
  },
  projects: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: await seedProject(brandId, ownerId) }),
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      name: "Made directly",
      garment_type: "crew-tee",
      created_by: userId,
    }),
    change: { name: "Changed by a stranger" },
  },
  spec_versions: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      return must(
        await adminClient().from("spec_versions").select("id").eq("project_id", projectId).single(),
      );
    },
    attempt: (brandId, userId) => ({
      project_id: randomUUID(),
      brand_id: brandId,
      version: 1,
      spec: { made: "directly" },
      schema_version: 1,
      note: "Made directly.",
      created_by: userId,
    }),
    change: { note: "Changed by a stranger." },
  },
  // Validation gate, V1 (migration 20261025010000): a member reads the status of their brand's design
  // versions; only set_design_status, run by the server, writes them.
  design_statuses: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      must(
        await adminClient().rpc("set_design_status", {
          p_project_id: projectId,
          p_brand_id: brandId,
          p_user_id: ownerId,
          p_version: 1,
          p_status: "validated",
          p_profile_id: "knitwright-default",
          p_findings_hash: "a".repeat(64),
        }),
      );
      return { project_id: projectId };
    },
    attempt: (brandId, userId) => ({
      project_id: randomUUID(),
      brand_id: brandId,
      version: 1,
      status: "draft",
      changed_by: userId,
    }),
    change: { status: "ordered" },
  },
  export_downloads: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      must(
        await adminClient().rpc("record_export_download", {
          p_project_id: projectId,
          p_user_id: ownerId,
          p_spec_version: 1,
          p_format: "pdf",
          p_view: null,
        }),
      );
      return { project_id: projectId };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      spec_version: 1,
      format: "pdf",
      user_id: userId,
    }),
    change: { format: "xlsx" },
  },
  // Plan step 10: a member can neither change a limit nor delete a usage event.
  usage_events: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const reserved = must(
        await adminClient().rpc("usage_reserve", {
          p_user_id: ownerId,
          p_brand_id: brandId,
          p_feature: "ai",
          p_cost: 1,
          p_route: "POST /api/isolation",
          p_user_allowance: UNLIMITED,
          p_brand_allowance: UNLIMITED,
          p_global_ceiling: UNLIMITED,
        }),
      ) as { event_id: string };
      return { id: reserved.event_id };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      user_id: userId,
      feature: "ai",
      cost: 1,
      day: "2026-01-01",
      route: "made directly",
    }),
    change: { cost: 1_000_000, refunded_at: "2026-01-01T00:00:00Z" },
  },
  usage_limits: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId) => ({
      id: must(
        await adminClient().rpc("usage_set_limit", {
          p_subject: "brand",
          p_subject_id: brandId,
          p_feature: "photoreal",
          p_monthly_allowance: 5,
        }),
      ),
    }),
    attempt: (brandId) => ({ brand_id: brandId, feature: "ai", monthly_allowance: UNLIMITED }),
    change: { monthly_allowance: UNLIMITED },
  },
  // Plan step 14: a member reads the brand's jobs; only the server starts or finishes one.
  jobs: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      return must(
        await adminClient()
          .from("jobs")
          .insert({ brand_id: brandId, project_id: projectId, version: 1, kind: "photoreal", created_by: ownerId })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      version: 1,
      kind: "photoreal",
      created_by: userId,
    }),
    change: { status: "failed", error: "Changed by a stranger.", finished_at: "2026-01-01T00:00:00Z" },
  },
  // Patterns: a member reads the brand's pattern jobs; only the server asks for or finishes one.
  pattern_jobs: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      return must(
        await adminClient()
          .from("pattern_jobs")
          .insert({
            brand_id: brandId,
            project_id: projectId,
            version: 1,
            provider: "claude-bridge",
            request: { typeId: "crew-tee" },
            size_label: "M",
            created_by: ownerId,
          })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      version: 1,
      provider: "claude-bridge",
      request: { typeId: "crew-tee" },
      size_label: "M",
      created_by: userId,
    }),
    change: { status: "failed", error: "Changed by a stranger.", finished_at: "2026-01-01T00:00:00Z" },
  },
  // Production outputs, W2 (migration 20261015020000): a member reads the brand's fabrics, fabric tests
  // and size label maps; only the server writes them, and a fabric test is never changed.
  base_fabrics: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) =>
      must(
        await adminClient()
          .from("base_fabrics")
          .insert({ brand_id: brandId, name: "Seeded interlock", profile: {}, created_by: ownerId })
          .select("id")
          .single(),
      ),
    attempt: (brandId, userId) => ({ brand_id: brandId, name: "Made directly", profile: {}, created_by: userId }),
    change: { name: "Changed by a stranger" },
  },
  fabric_tests: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const fabric = must(
        await adminClient()
          .from("base_fabrics")
          .insert({ brand_id: brandId, name: "Tested interlock", profile: {}, created_by: ownerId })
          .select("id")
          .single(),
      );
      return must(
        await adminClient()
          .from("fabric_tests")
          .insert({
            brand_id: brandId,
            fabric_id: fabric.id,
            tested_by: "Priya Nair",
            tested_on: "2026-10-01",
            method: "Seeded",
            reduction_pct: 3,
            created_by: ownerId,
          })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      fabric_id: randomUUID(),
      tested_by: "Someone",
      tested_on: "2026-10-01",
      method: "Made directly",
      reduction_pct: 3,
      created_by: userId,
    }),
    change: { tested_by: "Changed by a stranger" },
  },
  // Production outputs, W7b (migration 20261015060100): a member reads the brand's artwork records; only the
  // server writes them. A vector artwork is JSON, never an SVG.
  user_artworks: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const fileId = randomUUID();
      must(
        await adminClient().from("files").insert({
          id: fileId,
          brand_id: brandId,
          bucket: "uploads",
          path: filePath(brandId),
          kind: "artwork",
          content_type: "image/png",
          bytes: 10,
          created_by: ownerId,
        }),
      );
      const vectorId = randomUUID();
      must(
        await adminClient().from("files").insert({
          id: vectorId,
          brand_id: brandId,
          bucket: "exports",
          path: `${brandId}/artwork-vector/${randomUUID()}.json`,
          kind: "artwork-vector",
          content_type: "application/json",
          bytes: 10,
          created_by: ownerId,
        }),
      );
      return must(
        await adminClient()
          .from("user_artworks")
          .insert({
            brand_id: brandId,
            kind: "vector",
            source_format: "svg",
            label: "Seeded crest",
            source_sha256: "a".repeat(64),
            print_sha256: "b".repeat(64),
            vector_file_id: vectorId,
            screen_file_id: fileId,
            width_px: 100,
            height_px: 100,
            colour_space: "srgb",
            has_alpha: true,
            rights_confirmed_by: ownerId,
            rights_confirmed_at: "2026-10-14T00:00:00Z",
            rights_wording_version: "logo-rights-v1",
            created_by: ownerId,
          })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      kind: "vector",
      source_format: "svg",
      label: "Made directly",
      source_sha256: "a".repeat(64),
      print_sha256: "b".repeat(64),
      vector_file_id: randomUUID(),
      screen_file_id: randomUUID(),
      width_px: 100,
      height_px: 100,
      colour_space: "srgb",
      has_alpha: true,
      rights_confirmed_by: userId,
      rights_confirmed_at: "2026-10-14T00:00:00Z",
      rights_wording_version: "logo-rights-v1",
      created_by: userId,
    }),
    change: { label: "Changed by a stranger" },
  },
  size_label_maps: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) =>
      must(
        await adminClient()
          .from("size_label_maps")
          .insert({ brand_id: brandId, label: "M", wearer: "men", cut: "mens", pattern_size: "48", source: "user-edited", updated_by: ownerId })
          .select("id")
          .single(),
      ),
    attempt: (brandId, userId) => ({ brand_id: brandId, label: "M", wearer: "men", cut: "mens", pattern_size: "50", source: "user-edited", updated_by: userId }),
    change: { pattern_size: "52" },
  },
  // Print files (W3, migration 20261015030000): a member reads the brand's print profile and league rule sets; only the server writes.
  print_profiles: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      must(await adminClient().from("print_profiles").insert({ brand_id: brandId, source: "print-house", updated_by: ownerId }).select("brand_id"));
      return { brand_id: brandId };
    },
    attempt: (brandId, userId) => ({ brand_id: brandId, source: "print-house", updated_by: userId }),
    change: { bleed_mm: 30 },
  },
  league_rule_sets: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) =>
      must(
        await adminClient()
          .from("league_rule_sets")
          .insert({ brand_id: brandId, name: "Seeded league", source: "League handbook", rules: {}, created_by: ownerId })
          .select("id")
          .single(),
      ),
    attempt: (brandId, userId) => ({ brand_id: brandId, name: "Made directly", source: "Nowhere", rules: {}, created_by: userId }),
    change: { name: "Changed by a stranger" },
  },
  // Production outputs, W7d (migration 20261015060200): a member reads the brand's design imports; only the
  // server writes them, and an import that was accepted or discarded is never changed again.
  design_imports: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) =>
      must(
        await adminClient()
          .from("design_imports")
          .insert({
            brand_id: brandId,
            source_file_id: randomUUID(),
            rights_accepted_at: "2026-10-15T00:00:00Z",
            reading: {},
            report: {},
            overlay: {},
            result: {},
            created_by: ownerId,
          })
          .select("id")
          .single(),
      ),
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      source_file_id: randomUUID(),
      rights_accepted_at: "2026-10-15T00:00:00Z",
      reading: {},
      report: {},
      overlay: {},
      result: {},
      created_by: userId,
    }),
    change: { status: "discarded" },
  },
  // The pattern library (W1): a member reads the brand's blocks, their sizes and reviews; only the server writes.
  pattern_blocks: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => seedBlock(brandId, ownerId),
    attempt: (brandId, userId) => ({ ...blockRow(brandId, userId), name: "Made directly" }),
    change: { name: "Changed by a stranger" },
  },
  pattern_block_sizes: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const block = await seedBlock(brandId, ownerId);
      return must(
        await adminClient()
          .from("pattern_block_sizes")
          .insert({ brand_id: brandId, block_id: block.id, size_label: "M", position: 0, pieces: [{ id: "front" }], measurements: [] })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId) => ({ brand_id: brandId, block_id: randomUUID(), size_label: "M", position: 0, pieces: [{ id: "front" }], measurements: [] }),
    change: { size_label: "XL" },
  },
  pattern_reviews: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const block = await seedBlock(brandId, ownerId);
      return must(
        await adminClient()
          .from("pattern_reviews")
          .insert({ brand_id: brandId, block_id: block.id, reviewer_name: "A. Tailor", reviewed_on: "2026-10-20", created_by: ownerId })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId, userId) => ({ brand_id: brandId, block_id: randomUUID(), reviewer_name: "A. Tailor", reviewed_on: "2026-10-20", created_by: userId }),
    change: { reviewer_name: "Changed by a stranger" },
  },
  // The assistant audit, item 3: a member reads the brand's conversations; only the server adds a
  // line, and none is ever changed or removed.
  assistant_messages: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      return must(
        await adminClient()
          .from("assistant_messages")
          .insert({ brand_id: brandId, project_id: projectId, role: "person", kind: "text", body: "slim fit" })
          .select("id")
          .single(),
      );
    },
    attempt: (brandId) => ({ brand_id: brandId, project_id: randomUUID(), role: "person", kind: "text", body: "Made directly." }),
    change: { body: "Changed by a stranger." },
  },
  // Decision 0025: a person reads their own consent records; only the server adds one, and none
  // is ever changed or removed.
  consent_events: {
    privileges: ["SELECT"],
    brandColumn: "user_id",
    ownedBy: "user",
    seed: async (_brandId, ownerId) => {
      must(
        await adminClient().rpc("record_consent", {
          p_user_id: ownerId,
          p_purpose: "marketing_email",
          p_granted: true,
          p_wording_version: "marketing-email-v1",
          p_source: "settings",
        }),
      );
      return { user_id: ownerId };
    },
    attempt: (ownerId) => ({
      user_id: ownerId,
      purpose: "marketing_email",
      granted: true,
      wording: "Made directly.",
      wording_version: "marketing-email-v1",
      source: "settings",
    }),
    change: { granted: false },
  },
  brand_size_charts: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({
      id: must(
        await adminClient().rpc("replace_brand_chart", {
          p_brand_id: brandId,
          p_user_id: ownerId,
          p_wearer: "men",
          p_garment_type: "crew-tee",
          p_fit: "any",
          p_chart: { seeded: true },
          p_run: { seeded: true },
          p_file_id: null,
        }),
      ),
    }),
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      wearer: "women",
      garment_type: "polo",
      fit: "any",
      chart: { made: "directly" },
      run: { made: "directly" },
      imported_by: userId,
    }),
    change: { fit: "slim" },
  },
  // Decision 0024: a member reads their brand's quote requests; only the server writes them, and
  // only platform admins change their status (tests/integration/leads.test.ts).
  quote_requests: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return {
        id: must(
          await adminClient().rpc("request_quote", {
            p_project_id: projectId,
            p_user_id: ownerId,
            p_version: 1,
            p_quantity: 50,
            p_needed_by: later,
            p_sizes_note: "",
            p_message: "",
          }),
        ),
      };
    },
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      version: 1,
      quantity: 10,
      needed_by: "2099-01-01",
      created_by: userId,
    }),
    change: { status: "closed", quantity: 1 },
  },
  // Decision 0026: members read their brand's share links; only the server makes or revokes one.
  share_links: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: (await seedShareLink(brandId, ownerId)).id }),
    attempt: (brandId, userId) => ({
      brand_id: brandId,
      project_id: randomUUID(),
      version: 1,
      token_hash: "\\x" + "00".repeat(32),
      created_by: userId,
      expires_at: "2099-01-01T00:00:00Z",
    }),
    change: { revoked_at: "2026-01-01T00:00:00Z", version: 9 },
  },
  // Answers left through a share link. Only the server keeps one, after the bot check.
  share_responses: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const link = await seedShareLink(brandId, ownerId);
      must(
        await adminClient().rpc("share_respond", {
          p_token: link.token,
          p_visitor_key: randomBytes(32).toString("base64url"),
          p_name: "Seeded visitor",
          p_vote: "yes",
          p_comment: null,
        }),
      );
      return { link_id: link.id };
    },
    attempt: (brandId) => ({
      link_id: randomUUID(),
      brand_id: brandId,
      visitor_hash: "\\x" + "00".repeat(32),
      name: "Made directly",
      vote: "yes",
    }),
    change: { vote: "not_yet", comment: "Changed by a stranger." },
  },
  // Plan W4 (decision 0032): members read their brand's team lists, releases, strike-offs and
  // sign-offs; only the server writes, through functions.
  team_orders: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: await seedTeamOrder(brandId, ownerId) }),
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), name: "Made directly", created_by: userId }),
    change: { name: "Changed by a stranger" },
  },
  team_order_rows: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ order_id: await seedTeamOrder(brandId, ownerId) }),
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, position: 1, name: "X", number: "1", size_label: "M", cut: "mens", quantity: 1 }),
    change: { name: "Changed by a stranger" },
  },
  ops_orders: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: await seedOpsOrder(brandId, ownerId) }),
    attempt: (brandId) => ({ release_id: randomUUID(), brand_id: brandId, project_id: randomUUID(), external_ref: "made-directly", factory_profile_id: "f", fabric_key: "f", article_id: "a", sizes: { M: 1 }, pieces: 1, release_snapshot: {}, cutoff_at: new Date().toISOString() }),
    change: { status: "ready" },
  },
  ops_order_events: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ order_id: await seedOpsOrder(brandId, ownerId) }),
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, kind: "submitted", to_status: "submitted" }),
    change: { note: "Changed by a stranger" },
  },
  production_releases: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: (await seedRelease(brandId, ownerId)).releaseId }),
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), number: 1, label: "Made directly", snapshot: {}, file_specs: [], created_by: userId }),
    change: { label: "Changed by a stranger" },
  },
  strike_offs: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const { releaseId } = await seedRelease(brandId, ownerId);
      return { id: must(await adminClient().rpc("request_strike_off", { p_release_id: releaseId, p_brand_id: brandId, p_user_id: ownerId, p_note: "" })) as string };
    },
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), release_id: randomUUID(), requested_by: userId }),
    change: { status: "accepted" },
  },
  sign_offs: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const { releaseId } = await seedRelease(brandId, ownerId);
      return { id: must(await adminClient().rpc("add_sign_off", { p_release_id: releaseId, p_brand_id: brandId, p_user_id: ownerId, p_role: "club", p_signer_name: "Seeded Signer", p_signed_on: "2026-10-16", p_note: "" })) as string };
    },
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), release_id: randomUUID(), role: "club", signer_name: "X", signed_on: "2026-10-16", created_by: userId }),
    change: { signer_name: "Changed by a stranger" },
  },
  // Plan V4 (decision 0042): a club's kit, seasons, rosters and invitations; only the server writes.
  club_kits: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      must(await adminClient().rpc("save_club_kit", { p_brand_id: brandId, p_user_id: ownerId, p_kit: { primaryColour: "#0b3d91" } }));
      return { brand_id: brandId };
    },
    attempt: (brandId) => ({ brand_id: brandId, primary_colour: "#000000" }),
    change: { primary_colour: "#ff0000" },
  },
  club_seasons: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: await seedSeason(brandId, ownerId) }),
    attempt: (brandId) => ({ brand_id: brandId, name: "Made directly" }),
    change: { name: "Changed by a stranger" },
  },
  roster_players: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const season = await seedSeason(brandId, ownerId);
      must(await adminClient().rpc("replace_season_roster", { p_brand_id: brandId, p_user_id: ownerId, p_season_id: season, p_players: [{ name: "Seeded Player", number: "7", sizeLabel: "M", wearerGroup: "mens" }] }));
      return { season_id: season };
    },
    attempt: (brandId) => ({ season_id: randomUUID(), brand_id: brandId, position: 1, name: "X", number: "1", size_label: "M", wearer_group: "mens" }),
    change: { name: "Changed by a stranger" },
  },
  // Plan V6 (decision 0044): a brand's credits. A member reads the lines; only the server writes, through
  // functions, and a line is never changed.
  credit_ledger: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId) => {
      const key = `seed:${randomUUID()}`;
      must(await adminClient().rpc("credit_grant", { p_brand_id: brandId, p_amount: 1, p_key: key, p_note: "" }));
      return { brand_id: brandId, idempotency_key: key };
    },
    attempt: (brandId) => ({ brand_id: brandId, kind: "grant", amount: 5, idempotency_key: randomUUID() }),
    change: { amount: 99 },
  },
  // Plan W4-A (decision 0060): a brand's pattern service requests and their history. A member reads; only the server writes, through functions.
  pattern_requests: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: await seedPatternRequest(brandId, ownerId) }),
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), design_version: 1, article_id: "shorts", snapshot: {}, snapshot_hash: "0".repeat(64), requested_by: userId }),
    change: { status: "delivered", decline_reason: "Changed by a stranger" },
  },
  pattern_request_events: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ request_id: await seedPatternRequest(brandId, ownerId) }),
    attempt: (brandId) => ({ request_id: randomUUID(), brand_id: brandId, kind: "requested", to_status: "requested" }),
    change: { note: "Changed by a stranger" },
  },
  // Plan W4-D (decision 0063): design comments, their earlier words and the members they name. Members read their own
  // brand's rows; only the server writes, through functions; the earlier words are never changed.
  design_comments: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => ({ id: (await seedComment(brandId, ownerId)).commentId }),
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), version: 1, body: "Made directly", author_id: userId }),
    change: { body: "Changed by a stranger" },
  },
  design_comment_edits: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const { commentId } = await seedComment(brandId, ownerId);
      must(await adminClient().rpc("design_comment_edit", { p_brand_id: brandId, p_user_id: ownerId, p_comment_id: commentId, p_body: "Seeded, changed", p_mentions: [] }));
      return { comment_id: commentId };
    },
    attempt: (brandId, userId) => ({ comment_id: randomUUID(), brand_id: brandId, body: "Made directly", edited_by: userId }),
    change: { body: "Changed by a stranger" },
  },
  design_comment_mentions: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const guest = await person("comment-guest");
      await joinAsViewer(brandId, ownerId, guest);
      return { comment_id: (await seedComment(brandId, ownerId, [guest.userId])).commentId };
    },
    attempt: (brandId, userId) => ({ comment_id: randomUUID(), brand_id: brandId, user_id: userId }),
    change: { user_id: randomUUID() },
  },
  // Plan W3-A (decision 0054): media sets, their items and their history. A member reads; only the server writes, through functions.
  media_sets: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      const started = must(
        await adminClient().rpc("media_set_start", { p_brand_id: brandId, p_project_id: projectId, p_user_id: ownerId, p_version: 1, p_version_hash: `seed-${randomUUID()}` }),
      ) as { id: string };
      return { id: started.id };
    },
    attempt: (brandId, userId) => ({ brand_id: brandId, project_id: randomUUID(), version: 1, version_hash: randomUUID(), created_by: userId }),
    change: { status: "succeeded", unlocked_at: "2026-01-01T00:00:00Z" },
  },
  media_items: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      const started = must(
        await adminClient().rpc("media_set_start", { p_brand_id: brandId, p_project_id: projectId, p_user_id: ownerId, p_version: 1, p_version_hash: `seed-${randomUUID()}` }),
      ) as { id: string };
      must(await adminClient().rpc("media_set_move", { p_set_id: started.id, p_from: ["queued"], p_to: "running" }));
      const id = must(
        await adminClient().rpc("media_item_put", { p_set_id: started.id, p_kind: "studio_render", p_view: "front", p_file_id: null, p_clean_path: `_private/${brandId}/${started.id}/studio_render-front.png`, p_width: 10, p_height: 10, p_provider: "knitwright-flat", p_cost_microdollars: 0, p_verdict: "not_checked" }),
      ) as string;
      return { id };
    },
    attempt: (brandId) => ({ set_id: randomUUID(), brand_id: brandId, kind: "studio_render", view: "front" }),
    change: { checker_verdict: "passed", clean_path: "_private/x/y.png" },
  },
  media_set_history: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const projectId = await seedProject(brandId, ownerId);
      const started = must(
        await adminClient().rpc("media_set_start", { p_brand_id: brandId, p_project_id: projectId, p_user_id: ownerId, p_version: 1, p_version_hash: `seed-${randomUUID()}` }),
      ) as { id: string };
      return { set_id: started.id, status: "queued" };
    },
    attempt: (brandId) => ({ set_id: randomUUID(), brand_id: brandId, status: "queued" }),
    change: { note: "Changed by a stranger" },
  },
  club_invitations: {
    privileges: ["SELECT"],
    brandColumn: "brand_id",
    seed: async (brandId, ownerId) => {
      const email = `invited-${randomUUID()}@test.knitwright.local`;
      must(await adminClient().rpc("invite_member", { p_brand_id: brandId, p_user_id: ownerId, p_email: email, p_role: "viewer" }));
      return { email };
    },
    attempt: (brandId) => ({ brand_id: brandId, email: "made-directly@test.knitwright.local", role: "viewer" }),
    change: { role: "admin" },
  },
};

/** A season of a brand, made the way the server makes one. */
const seedSeason = async (brandId: string, ownerId: string): Promise<string> =>
  must(await adminClient().rpc("create_club_season", { p_brand_id: brandId, p_user_id: ownerId, p_name: `Season ${randomUUID().slice(0, 8)}`, p_starts_on: null, p_ends_on: null })) as string;

/** A team list made the way the server makes one, for a new design. */
const seedTeamOrder = async (brandId: string, ownerId: string): Promise<string> =>
  must(
    await adminClient().rpc("save_team_order", {
      p_order_id: null,
      p_project_id: await seedProject(brandId, ownerId),
      p_brand_id: brandId,
      p_user_id: ownerId,
      p_name: "Seeded list",
      p_rows: [{ name: "SEEDED", number: "7", size_label: "M", cut: "mens", quantity: 1 }],
    }),
  ) as string;

/** A release made the way the server makes one, for a new design. */
const seedRelease = async (brandId: string, ownerId: string): Promise<{ releaseId: string }> => {
  const rows = must(
    await adminClient().rpc("create_release", {
      p_project_id: await seedProject(brandId, ownerId),
      p_brand_id: brandId,
      p_user_id: ownerId,
      p_label: "Seeded release",
      p_snapshot: {},
      p_file_specs: [],
      p_order_id: null,
    }),
  ) as { id: string }[];
  return { releaseId: rows[0].id };
};

/** An order in production, submitted the way the Store submits one. Returns its id. */
const seedOpsOrder = async (brandId: string, ownerId: string): Promise<string> => {
  const { releaseId } = await seedRelease(brandId, ownerId);
  const rows = must(
    await adminClient().rpc("submit_order_for_production", {
      p_release_id: releaseId,
      p_external_ref: `isolation-${randomUUID()}`,
      p_factory_profile_id: "f1",
      p_fabric_key: "mesh",
      p_article_id: "crew-tee",
      p_sizes: { M: 1 },
    }),
  ) as { order_id: string }[];
  return rows[0].order_id;
};

/** An order of the brand that the factory has marked ready, with the ops admin who moved it. For the ops QC tables (decision 0050). */
const seedReadyOrder = async (brandId: string): Promise<{ orderId: string; actor: string }> => {
  const owner = must(await adminClient().from("memberships").select("user_id").eq("brand_id", brandId).limit(1).single()) as { user_id: string };
  const ops = await person("qc-admin");
  must(await adminClient().from("platform_admins").insert({ user_id: ops.userId }).select("user_id"));
  const orderId = await seedOpsOrder(brandId, owner.user_id);
  const order = must(await adminClient().from("ops_orders").select("cutoff_at").eq("id", orderId).single()) as { cutoff_at: string };
  must(await adminClient().rpc("ops_cut_batches", { p_actor: ops.userId, p_now: new Date(Date.parse(order.cutoff_at) + 1000).toISOString() }));
  for (const to of ["received", "in_production", "ready"]) must(await adminClient().rpc("ops_set_order_status", { p_actor: ops.userId, p_order_id: orderId, p_to: to }));
  return { orderId, actor: ops.userId };
};

const PASSING_CHECKLIST = ["measurements", "colour", "artwork", "names_numbers"].map((key) => ({ key, result: "pass", note: "" }));
const inspect = async (actor: string, orderId: string) =>
  must(await adminClient().rpc("ops_record_inspection", { p_actor: actor, p_order_id: orderId, p_checklist: PASSING_CHECKLIST, p_measurements: [{ point: "Chest", specMm: 520, measuredMm: 521, toleranceMm: 5 }], p_sample_size: 1, p_defect_count: 0 })) as { inspection_id: string }[];

/** A share link made the way the server makes one, to a new design. */
const seedShareLink = async (brandId: string, ownerId: string): Promise<{ id: string; token: string }> => {
  const projectId = await seedProject(brandId, ownerId);
  const token = randomBytes(32).toString("base64url");
  const rows = must(
    await adminClient().rpc("create_share_link", {
      p_project_id: projectId,
      p_user_id: ownerId,
      p_token: token,
      p_days: 30,
    }),
  ) as { id: string }[];
  return { id: rows[0].id, token };
};

/** A pattern service request made the way the server makes one, for a new design. Returns its id. */
const seedPatternRequest = async (brandId: string, ownerId: string): Promise<string> => {
  const projectId = await seedProject(brandId, ownerId);
  const out = must(
    await adminClient().rpc("pattern_request_create", {
      p_brand_id: brandId, p_user_id: ownerId, p_project_id: projectId, p_design_version: 1, p_article_id: "shorts",
      p_snapshot: { seeded: true }, p_snapshot_hash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      p_price_credits: null, p_turnaround_days: null, p_charge: false,
    }),
  ) as { request_id: string };
  return out.request_id;
};

/** A project made the way the server makes one. Returns its id. */
/** Has someone accept an invitation to the brand as a viewer, so a comment has a second member to name. */
const joinAsViewer = async (brandId: string, ownerId: string, guest: Person): Promise<void> => {
  must(await adminClient().rpc("invite_member", { p_brand_id: brandId, p_user_id: ownerId, p_email: guest.email, p_role: "viewer" }));
  const invitations = must(await guest.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  must(await adminClient().rpc("accept_invitation", { p_user_id: guest.userId, p_invitation_id: mine?.id }));
};

/** A comment on a new design of the brand, written by its owner. */
const seedComment = async (brandId: string, ownerId: string, mentions: readonly string[] = []): Promise<{ commentId: string }> => {
  const projectId = await seedProject(brandId, ownerId);
  const commentId = must(
    await adminClient().rpc("design_comment_add", {
      p_brand_id: brandId, p_user_id: ownerId, p_project_id: projectId, p_parent_id: null, p_version: 1,
      p_panel_id: null, p_x_mm: null, p_y_mm: null, p_body: "Seeded comment", p_mentions: mentions,
    }),
  ) as string;
  return { commentId };
};

const seedProject = async (brandId: string, ownerId: string): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: ownerId,
      p_name: "Seeded design",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { seeded: true },
      p_schema_version: 1,
    }),
  );

/**
 * Tables that belong to the platform but that every signed-in person may read (and no visitor).
 * Only the server writes them.
 */
type SharedTableSpec = Readonly<{
  privileges: readonly string[];
  /** A row that exists, by its key. */
  row: Row;
  attempt: Row;
  change: Row;
}>;

const SHARED_TABLES: Readonly<Record<string, SharedTableSpec>> = {
  // Plan V6 (decision 0044): what an output costs in credits.
  credit_prices: {
    privileges: ["SELECT"],
    row: { output_kind: "pattern_file" },
    attempt: { output_kind: "invented", credits: 1 },
    change: { credits: 0 },
  },
  // Plan V1 (decision 0039): the factory profile every design is checked against.
  factory_profiles: {
    privileges: ["SELECT"],
    row: { id: "knitwright-default" },
    attempt: { id: "made-directly", name: "Made directly", label: "Made directly", profile: {} },
    change: { name: "Changed by a member" },
  },
};

/**
 * Tables no member may read at all, not even for their own brand: only platform admins, through
 * policies and functions that check platform_admins (decision 0024). Each seeds a row and the
 * suite checks that a member, and a visitor, can neither see nor touch it.
 */
type PlatformTableSpec = Readonly<{
  privileges: readonly string[];
  seed: (brandId: string) => Promise<Row>;
  attempt: (brandId: string, userId: string) => Row;
  change: Row;
}>;

const PLATFORM_TABLES: Readonly<Record<string, PlatformTableSpec>> = {
  leads: {
    privileges: ["SELECT"],
    // Only a platform admin writes a lead, through admin_set_lead.
    seed: async (brandId) => {
      const admin = await person("lead-admin");
      must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
      must(
        await admin.client.rpc("admin_set_lead", {
          p_brand_id: brandId,
          p_owner: "partner",
          p_next_step: "Seeded",
          p_next_step_on: null,
        }),
      );
      return { brand_id: brandId };
    },
    attempt: (brandId) => ({ brand_id: brandId, owner: "knitwright" }),
    change: { owner: "knitwright", next_step: "Changed by a member" },
  },
  // Requests for access while sign-up is by invitation (migration 20261013030000). The server writes
  // them through request_access; only platform admins read them.
  access_requests: {
    privileges: ["SELECT"],
    seed: async () => {
      const id = must(
        await adminClient().rpc("request_access", {
          p_email: `seeded-${Date.now()}@example.com`,
          p_name: "Seeded",
          p_organisation: "",
          p_organisation_type: "club",
          p_message: "",
        }),
      );
      return { id };
    },
    attempt: () => ({ email: "intruder@example.com", name: "Intruder" }),
    change: { name: "Changed by a member" },
  },
  ops_settings: {
    privileges: ["SELECT"],
    // The one seeded row. Only an ops function changes it.
    seed: async () => ({ id: true }),
    attempt: () => ({ id: false, cutoff_weekday: 1, cutoff_time: "09:00", label: "Made directly" }),
    change: { label: "Changed by a member" },
  },
  batches: {
    privileges: ["SELECT"],
    // Cut by ops_cut_batches, as of a week after the order's cut-off.
    seed: async (brandId) => {
      const owner = must(await adminClient().from("memberships").select("user_id").eq("brand_id", brandId).limit(1).single()) as { user_id: string };
      const ops = await person("batch-admin");
      must(await adminClient().from("platform_admins").insert({ user_id: ops.userId }).select("user_id"));
      const orderId = await seedOpsOrder(brandId, owner.user_id);
      const order = must(await adminClient().from("ops_orders").select("cutoff_at").eq("id", orderId).single()) as { cutoff_at: string };
      must(await adminClient().rpc("ops_cut_batches", { p_actor: ops.userId, p_now: new Date(Date.parse(order.cutoff_at) + 1000).toISOString() }));
      const batch = must(await adminClient().from("ops_orders").select("batch_id").eq("id", orderId).single()) as { batch_id: string };
      return { id: batch.batch_id };
    },
    attempt: () => ({ factory_profile_id: "f", fabric_key: "f", article_id: "a", cutoff_at: new Date().toISOString() }),
    change: { article_id: "changed" },
  },
  // Ops console part 2 (decision 0050): read by platform admins only, written by ops functions only.
  ops_qc_inspections: {
    privileges: ["SELECT"],
    seed: async (brandId) => {
      const { orderId, actor } = await seedReadyOrder(brandId);
      return { id: (await inspect(actor, orderId))[0]!.inspection_id };
    },
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, factory_profile_id: "f", result: "pass", checklist: [], sample_size: 1, defect_count: 0 }),
    change: { result: "fail" },
  },
  ops_exceptions: {
    privileges: ["SELECT"],
    seed: async (brandId) => {
      const { orderId, actor } = await seedReadyOrder(brandId);
      return { id: must(await adminClient().rpc("ops_raise_exception", { p_actor: actor, p_order_id: orderId, p_kind: "lost_parcel", p_owner: "Sam", p_due_on: "2099-01-01" })) as string };
    },
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, kind: "lost_parcel", owner: "x", due_on: "2099-01-01" }),
    change: { status: "resolved" },
  },
  ops_exception_events: {
    privileges: ["SELECT"],
    seed: async (brandId) => {
      const { orderId, actor } = await seedReadyOrder(brandId);
      const id = must(await adminClient().rpc("ops_raise_exception", { p_actor: actor, p_order_id: orderId, p_kind: "lost_parcel", p_owner: "Sam", p_due_on: "2099-01-01" })) as string;
      return { exception_id: id };
    },
    attempt: (brandId) => ({ exception_id: randomUUID(), order_id: randomUUID(), brand_id: brandId, kind: "raised", owner: "x", due_on: "2099-01-01" }),
    change: { note: "Changed by a member" },
  },
  ops_cartons: {
    privileges: ["SELECT"],
    seed: async (brandId) => {
      const { orderId, actor } = await seedReadyOrder(brandId);
      must(await adminClient().rpc("ops_set_carton", { p_actor: actor, p_order_id: orderId, p_carton_no: 1, p_weight_g: null, p_length_mm: null, p_width_mm: null, p_height_mm: null }));
      return { order_id: orderId };
    },
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, carton_no: 1 }),
    change: { weight_g: 1 },
  },
  ops_pack_bags: {
    privileges: ["SELECT"],
    seed: async (brandId) => {
      const { orderId, actor } = await seedReadyOrder(brandId);
      must(await adminClient().rpc("ops_set_bags", { p_actor: actor, p_order_id: orderId, p_team_order_id: null, p_bags: [{ sizeLabel: "M", pieces: 1 }] }));
      return { order_id: orderId };
    },
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, bag_no: 1, size_label: "M", pieces: 1 }),
    change: { pieces: 2 },
  },
  ops_shipments: {
    privileges: ["SELECT"],
    seed: async (brandId) => {
      const { orderId, actor } = await seedReadyOrder(brandId);
      await inspect(actor, orderId);
      must(await adminClient().rpc("ops_record_shipment", { p_actor: actor, p_order_id: orderId, p_courier: "DHL", p_tracking_number: "T1", p_shipped_on: "2026-10-30", p_sizes: { M: 1 } }));
      return { order_id: orderId };
    },
    attempt: (brandId) => ({ order_id: randomUUID(), brand_id: brandId, courier: "x", tracking_number: "x", shipped_on: "2026-10-30", sizes: { M: 1 }, pieces: 1 }),
    change: { tracking_number: "changed" },
  },
  // Platform settings console (decision 0056): no browser role reads or writes either table. Only the server's key reads them and
  // platform_setting_set writes them.
  platform_settings: {
    privileges: [],
    seed: async () => {
      const admin = await person("settings-admin");
      must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
      must(await adminClient().rpc("platform_setting_set", { p_actor: admin.userId, p_key: "isolation.settings_row", p_value: 7 }));
      return { key: "isolation.settings_row" };
    },
    attempt: () => ({ key: "isolation.made_directly", value: 1 }),
    change: { value: 99 },
  },
  platform_settings_history: {
    privileges: [],
    seed: async () => {
      const admin = await person("settings-history-admin");
      must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
      must(await adminClient().rpc("platform_setting_set", { p_actor: admin.userId, p_key: "isolation.history_row", p_value: 7 }));
      return { key: "isolation.history_row" };
    },
    attempt: () => ({ key: "isolation.made_directly", value: 1 }),
    change: { value: 99 },
  },
  platform_admins: {
    privileges: [],
    seed: async () => {
      const someone = await person("admin");
      must(
        await adminClient().from("platform_admins").insert({ user_id: someone.userId }).select("user_id"),
      );
      return { user_id: someone.userId };
    },
    attempt: (_brandId, userId) => ({ user_id: userId }),
    change: { created_at: "2000-01-01T00:00:00Z" },
  },
};

/** Platform-owned tables every signed-in user may read and nobody but the server writes; tests/integration/templates.test.ts covers them. */
const LIBRARY_TABLES: Readonly<Record<string, Pick<PlatformTableSpec, "privileges">>> = {
  templates: { privileges: ["SELECT"] },
};

const BUCKETS = ["exports", "images", "uploads"] as const;

/** Functions a browser may call, and who may call them. Everything else is refused. */
const CALLABLE = {
  "public.signup_is_open()": { anon: true, authenticated: true },
  "public.create_brand(p_name text)": { anon: false, authenticated: true },
  "public.rename_brand(p_brand_id uuid, p_name text)": { anon: false, authenticated: true },
  // Names of the caller's own brand's members, for "Made by" (tests/integration/member-names.test.ts).
  "public.brand_member_names(p_brand_id uuid)": { anon: false, authenticated: true },
  // Decision 0042: the caller's own club's members, and the invitations that name the caller's address.
  "public.club_members(p_brand_id uuid)": { anon: false, authenticated: true },
  "public.my_club_invitations()": { anon: false, authenticated: true },
  // Decision 0024: a member sets their own brand's organisation details.
  "public.set_brand_details(p_brand_id uuid, p_organisation_type text, p_country text, p_region text)": {
    anon: false,
    authenticated: true,
  },
  // Decision 0024: callable by any signed-in person, but each refuses anyone not in platform_admins.
  "public.am_platform_admin()": { anon: false, authenticated: true },
  "public.admin_lead_rows()": { anon: false, authenticated: true },
  "public.admin_set_lead(p_brand_id uuid, p_owner text, p_next_step text, p_next_step_on date)": {
    anon: false,
    authenticated: true,
  },
  "public.admin_set_quote_status(p_quote_id uuid, p_status text)": { anon: false, authenticated: true },
  // Used inside access rules. They cannot be called through the API.
  "private.is_member(p_brand_id uuid)": { anon: false, authenticated: true },
  "private.brand_id_from(p_text text)": { anon: false, authenticated: true },
  "private.is_platform_admin()": { anon: false, authenticated: true },
  "private.can_manage_members(p_user_id uuid, p_brand_id uuid)": { anon: false, authenticated: true },
} as const;

type Report = Readonly<{
  tables: { name: string; rls_enabled: boolean; client_privileges: string[] }[];
  buckets: { id: string; public: boolean }[];
  storage_policies: { name: string; command: string }[];
  storage_tables: { name: string; rls_enabled: boolean }[];
  functions: {
    signature: string;
    security_definer: boolean;
    fixed_search_path: boolean;
    anon: boolean;
    authenticated: boolean;
  }[];
}>;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

let report: Report;
let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const rowsAsServer = async (table: string, keys: Row): Promise<Row[]> =>
  must(await adminClient().from(table).select("*").match(keys));

const rowAsServer = async (table: string, keys: Row): Promise<Row | undefined> =>
  (await rowsAsServer(table, keys))[0];

beforeAll(async () => {
  report = must(await adminClient().rpc("security_report")) as Report;
  [alice, bob] = await Promise.all([person("alice"), person("bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("what exists", () => {
  it("has row level security on every table", () => {
    expect(report.tables.filter((table) => !table.rls_enabled).map((table) => table.name)).toEqual(
      [],
    );
  });

  it("has a test below for every table, and no test for a table that is gone", () => {
    expect(report.tables.map((table) => table.name).sort()).toEqual(
      [...Object.keys(TABLES), ...Object.keys(PLATFORM_TABLES), ...Object.keys(SHARED_TABLES), ...Object.keys(LIBRARY_TABLES)].sort(),
    );
  });

  it("lets a browser do to each table only what is written down here", () => {
    for (const table of report.tables) {
      expect([table.name, table.client_privileges]).toEqual([
        table.name,
        [...(TABLES[table.name] ?? PLATFORM_TABLES[table.name] ?? SHARED_TABLES[table.name] ?? LIBRARY_TABLES[table.name]).privileges].sort(),
      ]);
    }
  });

  it("has only private buckets, each with a test below", () => {
    expect(report.buckets).toEqual(BUCKETS.map((id) => ({ id, public: false })));
  });

  it("gives browsers no way to write to storage", () => {
    expect(report.storage_policies.map((policy) => policy.command)).toEqual(["select"]);
  });

  it("lets a browser call only the functions written down here", () => {
    const callable = Object.fromEntries(
      report.functions
        .filter((fn) => fn.anon || fn.authenticated)
        .map((fn) => [fn.signature, { anon: fn.anon, authenticated: fn.authenticated }]),
    );

    expect(callable).toEqual(CALLABLE);
  });

  it("fixes the search path of every function that runs with its owner's rights", () => {
    expect(
      report.functions
        .filter((fn) => fn.security_definer && !fn.fixed_search_path)
        .map((fn) => fn.signature),
    ).toEqual([]);
  });

  it("counts two functions with one name as two, so a second cannot hide behind the first", () => {
    const signatures = report.functions.map((fn) => fn.signature);

    expect(new Set(signatures).size).toBe(signatures.length);
    expect(signatures.every((signature) => /^\w+\.\w+\(.*\)$/.test(signature))).toBe(true);
  });

  it("has row level security on every table of the file store", () => {
    expect(report.storage_tables.length).toBeGreaterThan(0);
    expect(
      report.storage_tables.filter((table) => !table.rls_enabled).map((table) => table.name),
    ).toEqual([]);
  });

  it("keeps stored exports to formats a browser will not run", async () => {
    const { data } = await adminClient().storage.getBucket("exports");

    expect(data?.allowed_mime_types).not.toContain("image/svg+xml");
  });

  it("does not show this report to a browser", async () => {
    expect((await anonClient().rpc("security_report")).error).not.toBeNull();
    expect((await alice.client.rpc("security_report")).error).not.toBeNull();
  });
});

describe.each(Object.entries(TABLES))("table %s", (table, spec) => {
  let theirs: Row;
  let before: Row | undefined;
  // Whose rows are whose: brands for most tables, people for a table of one person's own rows.
  const aliceOwner = () => (spec.ownedBy === "user" ? alice.userId : aliceBrand);
  const bobOwner = () => (spec.ownedBy === "user" ? bob.userId : bobBrand);

  beforeAll(async () => {
    theirs = await spec.seed(bobBrand, bob.userId);
    await spec.seed(aliceBrand, alice.userId);
    before = await rowAsServer(table, theirs);
    expect(before).toBeDefined();
  });

  it("shows a member their own brand's rows", async () => {
    const rows = must(await alice.client.from(table).select("*"));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row[spec.brandColumn] === aliceOwner())).toBe(true);
  });

  it("shows a member nothing of another brand", async () => {
    const all = must(await alice.client.from(table).select("*"));
    const asked = must(await alice.client.from(table).select("*").match(theirs));

    expect(all.some((row) => row[spec.brandColumn] === bobOwner())).toBe(false);
    expect(asked).toEqual([]);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    const { data, error } = await anonClient().from(table).select("*");

    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("lets a member add nothing to another brand", async () => {
    const { error } = await alice.client.from(table).insert(spec.attempt(bobOwner(), alice.userId));

    expect(error).not.toBeNull();
  });

  it("lets a member add nothing directly, even to their own brand", async () => {
    const { error } = await alice.client
      .from(table)
      .insert(spec.attempt(aliceOwner(), alice.userId));

    expect(error).not.toBeNull();
  });

  it("lets a member change nothing of another brand", async () => {
    await alice.client.from(table).update(spec.change).match(theirs);

    expect(await rowAsServer(table, theirs)).toEqual(before);
  });

  it("lets a member delete nothing of another brand", async () => {
    await alice.client.from(table).delete().match(theirs);

    expect(await rowAsServer(table, theirs)).toEqual(before);
  });

  it("lets a member change or delete nothing of their own brand directly", async () => {
    const mine = { [spec.brandColumn]: aliceOwner() };
    const mineBefore = await rowsAsServer(table, mine);

    await alice.client.from(table).update(spec.change).match(mine);
    await alice.client.from(table).delete().match(mine);

    expect(await rowsAsServer(table, mine)).toEqual(mineBefore);
  });
});

describe.each(Object.entries(PLATFORM_TABLES))("platform table %s", (table, spec) => {
  let seeded: Row;
  let before: Row | undefined;

  beforeAll(async () => {
    seeded = await spec.seed(aliceBrand);
    before = await rowAsServer(table, seeded);
    expect(before).toBeDefined();
  });

  it("shows a member nothing, not even for their own brand", async () => {
    const { data } = await alice.client.from(table).select("*");

    expect(data ?? []).toEqual([]);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    const { data } = await anonClient().from(table).select("*");

    expect(data ?? []).toEqual([]);
  });

  it("lets a member add, change or delete nothing", async () => {
    const { error } = await alice.client.from(table).insert(spec.attempt(aliceBrand, alice.userId));
    await alice.client.from(table).update(spec.change).match(seeded);
    await alice.client.from(table).delete().match(seeded);

    expect(error).not.toBeNull();
    expect(await rowAsServer(table, seeded)).toEqual(before);
  });
});

describe.each(Object.entries(SHARED_TABLES))("shared table %s", (table, spec) => {
  it("shows a signed-in member its rows", async () => {
    expect(must(await alice.client.from(table).select("*").match(spec.row))).toHaveLength(1);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    const { data, error } = await anonClient().from(table).select("*");

    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("lets a member add, change or delete nothing", async () => {
    const before = await rowsAsServer(table, spec.row);
    const { error } = await alice.client.from(table).insert(spec.attempt);
    await alice.client.from(table).update(spec.change).match(spec.row);
    await alice.client.from(table).delete().match(spec.row);

    expect(error).not.toBeNull();
    expect(await rowsAsServer(table, spec.row)).toEqual(before);
  });
});

describe("memberships", () => {
  it("does not let a member join another brand", async () => {
    await alice.client
      .from("memberships")
      .insert({ brand_id: bobBrand, user_id: alice.userId, role: "owner" });

    expect(must(await alice.client.from("brands").select("id"))).toEqual([{ id: aliceBrand }]);
  });

  it("does not let a member change their own role", async () => {
    await alice.client
      .from("memberships")
      .update({ role: "admin" })
      .eq("brand_id", aliceBrand)
      .eq("user_id", alice.userId);

    expect(
      await rowAsServer("memberships", { brand_id: aliceBrand, user_id: alice.userId }),
    ).toMatchObject({ role: "owner" });
  });

  it("does not show a member who else belongs to other brands", async () => {
    const rows = must(await alice.client.from("memberships").select("user_id"));

    expect(rows).toEqual([{ user_id: alice.userId }]);
  });
});

describe.each(BUCKETS)("bucket %s", (bucket) => {
  const type = bucket === "exports" ? "application/pdf" : "image/png";
  let theirs: string;
  let mine: string;

  beforeAll(async () => {
    theirs = `${bobBrand}/test/${randomUUID()}`;
    mine = `${aliceBrand}/test/${randomUUID()}`;
    for (const path of [theirs, mine]) {
      must(await adminClient().storage.from(bucket).upload(path, PNG, { contentType: type }));
    }
  });

  it("lets a member read their own brand's file", async () => {
    const { data, error } = await alice.client.storage.from(bucket).download(mine);

    expect(error).toBeNull();
    expect(data?.size).toBe(PNG.byteLength);
  });

  it("does not let a member read another brand's file", async () => {
    const { data, error } = await alice.client.storage.from(bucket).download(theirs);

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("does not give a member a link to another brand's file", async () => {
    const { data, error } = await alice.client.storage.from(bucket).createSignedUrl(theirs, 60);

    expect(error).not.toBeNull();
    expect(data?.signedUrl).toBeUndefined();
  });

  it("does not list another brand's files", async () => {
    const { data } = await alice.client.storage.from(bucket).list(`${bobBrand}/test`);

    expect(data ?? []).toEqual([]);
  });

  it("serves nothing at a public address", async () => {
    const { data } = adminClient().storage.from(bucket).getPublicUrl(theirs);

    expect((await fetch(data.publicUrl)).ok).toBe(false);
  });

  it("lets a browser upload nothing, not even into its own brand's folder", async () => {
    const into = (brandId: string) =>
      alice.client.storage
        .from(bucket)
        .upload(`${brandId}/test/${randomUUID()}`, PNG, { contentType: type });

    expect((await into(bobBrand)).error).not.toBeNull();
    expect((await into(aliceBrand)).error).not.toBeNull();
  });

  it("lets a member replace, move or delete nothing of another brand", async () => {
    const files = alice.client.storage.from(bucket);

    await files.update(theirs, Buffer.from("replaced"), { contentType: type });
    await files.move(theirs, `${aliceBrand}/test/stolen-${randomUUID()}`);
    await files.remove([theirs]);

    const kept = must(await adminClient().storage.from(bucket).download(theirs));
    expect(Buffer.from(await kept.arrayBuffer())).toEqual(PNG);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    expect((await anonClient().storage.from(bucket).download(mine)).error).not.toBeNull();
  });

  it("treats a path that does not start with a brand id as belonging to nobody", async () => {
    const stray = `not-a-brand/${randomUUID()}`;
    must(await adminClient().storage.from(bucket).upload(stray, PNG, { contentType: type }));

    expect((await alice.client.storage.from(bucket).download(stray)).error).not.toBeNull();
  });
});
