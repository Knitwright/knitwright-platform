import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { runningShort } from "@/lib/benchmarks/fixtures/cards";
import { emptyCard } from "@/lib/benchmarks/schema";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261120030000: benchmarks (decision 0084, spec F-S2). What the database itself promises, whatever the
 * app does:
 *
 *  * a comparison and its cards belong to a brand, and nobody outside it sees them;
 *  * one URL is fetched **once** per brand, and the record of a fetch can never be unsaid;
 *  * a comparison holds five cards at most;
 *  * a card's provenance rules hold in the database too: every field says how it is known, a field that is not known
 *    holds no value, and a price or a GSM is stated or not known — never read off a picture;
 *  * **no page source and no third-party picture can be stored**: there is no column for either, and a card carrying
 *    markup is refused.
 *
 * Needs the local database. CI runs it.
 */

let owner: Person;
let outsider: Person;
let brand: string;
let other: string;

const rpc = (fn: string, args: Record<string, unknown>) => adminClient().rpc(fn, args);

const hash = () => randomUUID().replace(/-/g, "").padEnd(64, "0").slice(0, 64);

const card = (over: Record<string, unknown> = {}) => ({ ...runningShort(), ...over });

const makeBenchmark = async (brandId = brand, userId = owner.userId, projectId: string | null = null): Promise<string> =>
  must(await rpc("benchmark_create", { p_brand_id: brandId, p_user_id: userId, p_project_id: projectId, p_title: "Running shorts" })) as string;

const addCard = async (benchmarkId: string, over: Record<string, unknown> = {}) =>
  rpc("benchmark_card_add", {
    p_brand_id: brand,
    p_user_id: owner.userId,
    p_benchmark_id: benchmarkId,
    p_source_kind: "url",
    p_source_url: `https://shop.example.test/${randomUUID()}`,
    p_source_host: "shop.example.test",
    p_source_file_id: null,
    p_card: card(),
    p_extractor: "stub",
    ...over,
  });

const addedCard = async (benchmarkId: string, over: Record<string, unknown> = {}): Promise<string> =>
  must(await addCard(benchmarkId, over)) as string;

const seedProject = async (brandId: string, userId: string): Promise<string> =>
  must(
    await rpc("create_project", {
      p_brand_id: brandId, p_user_id: userId, p_name: "Benchmark design", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: { seeded: true }, p_schema_version: 1,
    }),
  ) as string;

beforeAll(async () => {
  [owner, outsider] = await Promise.all([person("bench-owner"), person("bench-outsider")]);
  [brand, other] = await Promise.all([brandOf(owner, "Benchmark FC"), brandOf(outsider, "Other FC")]);
});

describe("a comparison", () => {
  it("is kept with its brand, its name and the person who made it", async () => {
    const id = await makeBenchmark();
    const row = must(await adminClient().from("benchmarks").select("*").eq("id", id).single()) as Record<string, unknown>;

    expect(row).toMatchObject({ brand_id: brand, title: "Running shorts", created_by: owner.userId, project_id: null });
  });

  it("can be tied to a design of the same brand, and never to another brand's", async () => {
    const mine = await seedProject(brand, owner.userId);
    const theirs = await seedProject(other, outsider.userId);

    expect(await makeBenchmark(brand, owner.userId, mine)).toBeTruthy();
    expect((await rpc("benchmark_create", { p_brand_id: brand, p_user_id: owner.userId, p_project_id: theirs, p_title: "x" })).error?.code).toBe("P0002");
  });

  it("refuses a person who does not belong to the brand", async () => {
    expect((await rpc("benchmark_create", { p_brand_id: brand, p_user_id: outsider.userId, p_project_id: null, p_title: "x" })).error?.code).toBe("P0002");
  });

  it("asks for a name, and takes one no longer than the column", async () => {
    expect((await rpc("benchmark_create", { p_brand_id: brand, p_user_id: owner.userId, p_project_id: null, p_title: "  " })).error?.hint).toBe("invalid_input");
    expect((await rpc("benchmark_create", { p_brand_id: brand, p_user_id: owner.userId, p_project_id: null, p_title: "x".repeat(121) })).error?.hint).toBe("invalid_input");
  });
});

describe("one fetch per page, per brand", () => {
  it("claims a page once and says so the second time", async () => {
    const key = hash();
    const claim = { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "shop.example.test" };

    expect(must(await rpc("benchmark_fetch_claim", claim))).toBe("ok");
    expect(must(await rpc("benchmark_fetch_claim", claim))).toBe("already");
  });

  it("lets another brand read the same page: the count is per brand", async () => {
    const key = hash();

    expect(must(await rpc("benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "a.test" }))).toBe("ok");
    expect(must(await rpc("benchmark_fetch_claim", { p_brand_id: other, p_user_id: outsider.userId, p_url_sha256: key, p_host: "a.test" }))).toBe("ok");
  });

  it("keeps the host and the person, and fills in the outcome once", async () => {
    const key = hash();
    must(await rpc("benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "SHOP.Example.TEST" }));
    must(await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: "fetched" }));
    const row = must(await adminClient().from("benchmark_fetches").select("*").eq("url_sha256", key).eq("brand_id", brand).single()) as Record<string, unknown>;

    expect(row).toMatchObject({ host: "shop.example.test", outcome: "fetched", created_by: owner.userId });
    expect(row.settled_at).not.toBeNull();

    // Settled once: a second outcome does not overwrite the first.
    must(await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: "failed" }));
    expect(must(await adminClient().from("benchmark_fetches").select("outcome").eq("url_sha256", key).eq("brand_id", brand).single())).toMatchObject({ outcome: "fetched" });
  });

  it("lets a page that could not be reached be claimed again: nothing was read the first time", async () => {
    const key = hash();
    const claim = { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "a.test" };
    must(await rpc("benchmark_fetch_claim", claim));
    must(await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: "failed" }));

    expect(must(await rpc("benchmark_fetch_claim", claim))).toBe("ok");
    const row = must(await adminClient().from("benchmark_fetches").select("outcome, settled_at").eq("url_sha256", key).eq("brand_id", brand).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ outcome: "claimed" });
    expect(row.settled_at).toBeNull();
  });

  it("never lets a page that was read, or that the site refused, be claimed again", async () => {
    for (const outcome of ["fetched", "robots_refused"]) {
      const key = hash();
      const claim = { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "a.test" };
      must(await rpc("benchmark_fetch_claim", claim));
      must(await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: outcome }));

      expect(must(await rpc("benchmark_fetch_claim", claim)), outcome).toBe("already");
    }
  });

  it("refuses an outcome that is not one of the three", async () => {
    const key = hash();
    must(await rpc("benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "a.test" }));

    expect((await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: "claimed" })).error?.hint).toBe("invalid_input");
  });

  /**
   * Two separate refusals, and the test asserts what the database really does (Lesson 3). The server's own key holds
   * only SELECT on the table, so a direct write is refused by the grant before any trigger runs; the trigger is what
   * refuses a write made with the owner's rights, which is how the functions run.
   */
  it("can never be unsaid: the server's key may not write the table at all", async () => {
    const key = hash();
    must(await rpc("benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "a.test" }));

    expect((await adminClient().from("benchmark_fetches").delete().eq("url_sha256", key)).error?.message).toMatch(/permission denied/);
    expect((await adminClient().from("benchmark_fetches").update({ host: "elsewhere.test" }).eq("url_sha256", key)).error?.message).toMatch(/permission denied/);
    expect(must(await adminClient().from("benchmark_fetches").select("host").eq("url_sha256", key).eq("brand_id", brand).single())).toMatchObject({ host: "a.test" });
  });

  it("can never be unsaid: an outcome that was settled is never settled again", async () => {
    const key = hash();
    must(await rpc("benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: key, p_host: "a.test" }));
    must(await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: "robots_refused" }));
    must(await rpc("benchmark_fetch_settle", { p_brand_id: brand, p_url_sha256: key, p_outcome: "fetched" }));

    expect(must(await adminClient().from("benchmark_fetches").select("outcome").eq("url_sha256", key).eq("brand_id", brand).single())).toMatchObject({
      outcome: "robots_refused",
    });
  });

  it("refuses a key that is not a SHA-256", async () => {
    expect((await rpc("benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: "not-a-hash", p_host: "a.test" })).error).not.toBeNull();
  });
});

describe("a card", () => {
  it("is kept with its card, the source URL and the host, and nothing of the page", async () => {
    const benchmarkId = await makeBenchmark();
    const id = await addedCard(benchmarkId);
    const row = must(await adminClient().from("benchmark_cards").select("*").eq("id", id).single()) as Record<string, unknown>;

    expect(row).toMatchObject({ brand_id: brand, benchmark_id: benchmarkId, source_kind: "url", source_host: "shop.example.test", extractor: "stub", confirmed_at: null });
    expect(Object.keys(row)).not.toContain("html");
    expect(Object.keys(row)).not.toContain("body");
  });

  it("holds five at most, so a comparison is never wider than the spec allows", async () => {
    const benchmarkId = await makeBenchmark();
    for (let i = 0; i < 5; i += 1) await addedCard(benchmarkId);

    expect((await addCard(benchmarkId)).error?.hint).toBe("too_many_cards");
  });

  it("refuses a card carrying markup: nothing out of a page's source is ever stored", async () => {
    const benchmarkId = await makeBenchmark();
    const smuggled = card({ productName: { value: "<script>x</script>", provenance: "observed", corrected: false } });

    expect((await addCard(benchmarkId, { p_card: smuggled })).error).not.toBeNull();
  });

  it("refuses a card carrying an HTML entity", async () => {
    const benchmarkId = await makeBenchmark();
    const entity = card({ fit: { value: "Slim &amp; long", provenance: "observed", corrected: false } });

    expect((await addCard(benchmarkId, { p_card: entity })).error).not.toBeNull();
  });

  it("refuses a field that holds a value it says is not known, and one that explains nothing", async () => {
    const benchmarkId = await makeBenchmark();
    const held = card({ fit: { value: "Slim", provenance: "unknown", corrected: false } });
    const silent = card({ fit: { value: "Slim", corrected: false } });

    expect((await addCard(benchmarkId, { p_card: held })).error?.hint).toBe("invalid_card");
    expect((await addCard(benchmarkId, { p_card: silent })).error?.hint).toBe("invalid_card");
  });

  it("refuses a measurement read off a picture: that would be an invented measurement", async () => {
    const benchmarkId = await makeBenchmark();
    const guessed = card({ gsm: { value: 140, provenance: "inferred", corrected: false } });
    const guessedPrice = card({ price: { value: { minor: 4500, currency: "GBP" }, provenance: "inferred", corrected: false } });

    expect((await addCard(benchmarkId, { p_card: guessed })).error?.hint).toBe("invalid_card");
    expect((await addCard(benchmarkId, { p_card: guessedPrice })).error?.hint).toBe("invalid_card");
  });

  it("takes an empty card: knowing nothing is an honest answer", async () => {
    const benchmarkId = await makeBenchmark();

    expect(await addedCard(benchmarkId, { p_card: emptyCard() })).toBeTruthy();
  });

  it("refuses something that is not a card at all", async () => {
    const benchmarkId = await makeBenchmark();

    for (const bad of [{}, { productName: "a string" }, null]) {
      expect((await addCard(benchmarkId, { p_card: bad })).error, JSON.stringify(bad)).not.toBeNull();
    }
  });

  it("holds a source URL for a link and none for anything else", async () => {
    const benchmarkId = await makeBenchmark();
    const photo = { p_source_kind: "photo", p_source_url: null, p_source_host: null };

    expect(await addedCard(benchmarkId, photo)).toBeTruthy();
    expect((await addCard(benchmarkId, { ...photo, p_source_url: "https://example.test/p" })).error).not.toBeNull();
    expect((await addCard(benchmarkId, { p_source_url: null })).error).not.toBeNull();
  });

  it("names a photo only in the brand's own files", async () => {
    const benchmarkId = await makeBenchmark();
    const stranger = randomUUID();

    expect((await addCard(benchmarkId, { p_source_kind: "photo", p_source_url: null, p_source_host: null, p_source_file_id: stranger })).error?.code).toBe("P0002");
  });

  it("goes on a comparison of the caller's own brand only", async () => {
    const theirs = await makeBenchmark(other, outsider.userId);

    expect((await addCard(theirs)).error?.code).toBe("P0002");
  });
});

describe("confirming and removing a card", () => {
  it("records the person who confirmed it, and keeps the card they settled on", async () => {
    const benchmarkId = await makeBenchmark();
    const id = await addedCard(benchmarkId);
    const corrected = card({ fit: { value: "Regular", provenance: "observed", corrected: true } });

    must(await rpc("benchmark_card_confirm", { p_brand_id: brand, p_user_id: owner.userId, p_card_id: id, p_card: corrected }));
    const row = must(await adminClient().from("benchmark_cards").select("card, confirmed_at, confirmed_by").eq("id", id).single()) as Record<string, unknown>;

    expect(row.confirmed_by).toBe(owner.userId);
    expect(row.confirmed_at).not.toBeNull();
    expect((row.card as { fit: { value: string } }).fit.value).toBe("Regular");
  });

  it("refuses a correction that breaks the card's own rules", async () => {
    const benchmarkId = await makeBenchmark();
    const id = await addedCard(benchmarkId);
    const wrong = card({ gsm: { value: 140, provenance: "inferred", corrected: true } });

    expect((await rpc("benchmark_card_confirm", { p_brand_id: brand, p_user_id: owner.userId, p_card_id: id, p_card: wrong })).error?.hint).toBe("invalid_card");
  });

  it("is not found when it belongs to another brand", async () => {
    const benchmarkId = await makeBenchmark();
    const id = await addedCard(benchmarkId);

    expect((await rpc("benchmark_card_confirm", { p_brand_id: other, p_user_id: outsider.userId, p_card_id: id, p_card: card() })).error?.code).toBe("P0002");
    expect((await rpc("benchmark_card_remove", { p_brand_id: other, p_user_id: outsider.userId, p_card_id: id })).error?.code).toBe("P0002");
  });

  it("removes a card of the caller's own brand", async () => {
    const benchmarkId = await makeBenchmark();
    const id = await addedCard(benchmarkId);

    must(await rpc("benchmark_card_remove", { p_brand_id: brand, p_user_id: owner.userId, p_card_id: id }));
    expect(must(await adminClient().from("benchmark_cards").select("id").eq("id", id))).toEqual([]);
  });
});

describe("who sees what", () => {
  it("shows a member their own brand's comparisons, cards and fetches, and nothing of another brand's", async () => {
    const mine = await makeBenchmark();
    await addedCard(mine);
    const theirs = await makeBenchmark(other, outsider.userId);

    expect((must(await owner.client.from("benchmarks").select("id")) as { id: string }[]).map((row) => row.id)).toContain(mine);
    expect(must(await owner.client.from("benchmarks").select("id").eq("id", theirs))).toEqual([]);
    expect(must(await owner.client.from("benchmark_cards").select("brand_id, card"))).toEqual(
      expect.arrayContaining([expect.objectContaining({ brand_id: brand })]),
    );
    expect((must(await owner.client.from("benchmark_cards").select("brand_id")) as { brand_id: string }[]).every((row) => row.brand_id === brand)).toBe(true);
  });

  it("shows a visitor who is not signed in nothing", async () => {
    const { data, error } = await anonClient().from("benchmarks").select("id");

    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("lets a member write nothing directly, not even to their own brand", async () => {
    const benchmarkId = await makeBenchmark();

    expect((await owner.client.from("benchmarks").insert({ brand_id: brand, title: "Made directly" })).error).not.toBeNull();
    expect((await owner.client.from("benchmarks").update({ title: "Changed" }).eq("id", benchmarkId)).error).not.toBeNull();
    expect((await owner.client.from("benchmarks").delete().eq("id", benchmarkId)).error).not.toBeNull();
    expect(must(await adminClient().from("benchmarks").select("title").eq("id", benchmarkId).single())).toMatchObject({ title: "Running shorts" });
  });

  it("lets nobody call the write functions from a browser", async () => {
    const calls = [
      ["benchmark_create", { p_brand_id: brand, p_user_id: owner.userId, p_project_id: null, p_title: "x" }],
      ["benchmark_fetch_claim", { p_brand_id: brand, p_user_id: owner.userId, p_url_sha256: hash(), p_host: "a.test" }],
      ["benchmark_card_add", { p_brand_id: brand, p_user_id: owner.userId, p_benchmark_id: randomUUID(), p_source_kind: "url", p_source_url: "https://a.test/p", p_source_host: "a.test", p_source_file_id: null, p_card: card(), p_extractor: "stub" }],
    ] as const;

    for (const [fn, args] of calls) {
      expect((await owner.client.rpc(fn, args)).error, fn).not.toBeNull();
      expect((await anonClient().rpc(fn, args)).error, fn).not.toBeNull();
    }
  });
});

describe("what goes with the brand", () => {
  it("takes a brand's comparisons, cards and fetches with it when the brand is deleted", async () => {
    const guest = await person("bench-leaver");
    const leaving = await brandOf(guest, "Leaving FC");
    const benchmarkId = await makeBenchmark(leaving, guest.userId);
    must(await rpc("benchmark_fetch_claim", { p_brand_id: leaving, p_user_id: guest.userId, p_url_sha256: hash(), p_host: "a.test" }));
    must(
      await rpc("benchmark_card_add", {
        p_brand_id: leaving, p_user_id: guest.userId, p_benchmark_id: benchmarkId, p_source_kind: "photo", p_source_url: null,
        p_source_host: null, p_source_file_id: null, p_card: card(), p_extractor: "stub",
      }),
    );

    must(await adminClient().from("brands").delete().eq("id", leaving).select("id"));

    expect(must(await adminClient().from("benchmarks").select("id").eq("brand_id", leaving))).toEqual([]);
    expect(must(await adminClient().from("benchmark_cards").select("id").eq("brand_id", leaving))).toEqual([]);
    expect(must(await adminClient().from("benchmark_fetches").select("id").eq("brand_id", leaving))).toEqual([]);
  });
});
