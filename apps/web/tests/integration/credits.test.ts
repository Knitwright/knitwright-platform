import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261025060000: credits. The ledger is append-only and only the server writes; a
 * spend is charged once per output and design version; a refund is given once; a brand sees only
 * its own lines. Prices are set to known numbers here and put back afterwards: the real ones are
 * placeholders (lib/credits/settings.ts).
 */

type Answer = Record<string, unknown>;

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const rpc = async (fn: string, args: Record<string, unknown>): Promise<Answer> =>
  must(await adminClient().rpc(fn, args)) as Answer;

const grant = (brand: string, amount: number, key = randomUUID()) =>
  rpc("credit_grant", { p_brand_id: brand, p_amount: amount, p_key: key, p_note: "" });

const spend = (brand: string, who: Person, kind: string, hash: string) =>
  rpc("credit_spend", { p_brand_id: brand, p_user_id: who.userId, p_kind: kind, p_version_hash: hash });

const refundFor = (brand: string, hash: string) =>
  rpc("credit_refund_for_order", { p_brand_id: brand, p_version_hash: hash });

const balance = async (brand: string): Promise<number> =>
  Number(must(await adminClient().rpc("credit_balance", { p_brand_id: brand })));

const lines = async (brand: string) =>
  must(await adminClient().from("credit_ledger").select("*").eq("brand_id", brand).order("seq"));

/** A person may belong to at most 3 brands, so each test that needs a brand gets its own owner. */
const fresh = async (name: string) => {
  const owner = await person(`credits-${randomUUID().slice(0, 8)}`);
  return { owner, brand: await brandOf(owner, name) };
};

const hash = () => `h-${randomUUID()}`;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("credits-alice"), person("credits-bob")]);
  [aliceBrand, bobBrand] = await Promise.all([brandOf(alice, "Alice Credits"), brandOf(bob, "Bob Credits")]);
  must(
    await adminClient().rpc("credit_set_prices", {
      p_prices: { marketing_media: 1, techpack_pdf: 3, pattern_file: 2 },
      p_placeholder: true,
    }),
  );
});

afterAll(async () => {
  must(
    await adminClient().rpc("credit_set_prices", {
      p_prices: CREDIT_SETTINGS.prices,
      p_placeholder: CREDIT_SETTINGS.isPlaceholder,
    }),
  );
});

describe("the monthly allowance", () => {
  it("is given once a month and again in the next month", async () => {
    const { brand } = await fresh("Allowance Brand");
    const args = { p_brand_id: brand, p_amount: 10 };
    expect(await rpc("credit_ensure_allowance", { ...args, p_month: "2026-10-01" })).toMatchObject({ applied: true, balance: 10 });
    expect(await rpc("credit_ensure_allowance", { ...args, p_month: "2026-10-01" })).toMatchObject({ applied: false, balance: 10 });
    expect(await rpc("credit_ensure_allowance", { ...args, p_month: "2026-11-01" })).toMatchObject({ applied: true, balance: 20 });
  });

  it("refuses a date that is not the first of a month", async () => {
    const { error } = await adminClient().rpc("credit_ensure_allowance", { p_brand_id: aliceBrand, p_month: "2026-10-15", p_amount: 5 });
    expect(error).not.toBeNull();
  });
});

describe("credit_spend", () => {
  it("takes the price from credit_prices and records the line", async () => {
    const { owner, brand } = await fresh("Spend Brand");
    await grant(brand, 10);
    const answer = await spend(brand, owner, "techpack_pdf", hash());
    expect(answer).toMatchObject({ ok: true, charged: true, price: 3, balance: 7 });
    expect(await balance(brand)).toBe(7);
  });

  it("charges the same output of the same version once, however many times it is asked", async () => {
    const { owner, brand } = await fresh("Idempotent Brand");
    await grant(brand, 10);
    const h = hash();
    const answers = await Promise.all(Array.from({ length: 8 }, () => spend(brand, owner, "pattern_file", h)));
    expect(answers.filter((a) => a.charged === true)).toHaveLength(1);
    expect(await balance(brand)).toBe(8);
  });

  it("charges another output, or another version, separately", async () => {
    const { owner, brand } = await fresh("Separate Brand");
    await grant(brand, 10);
    const h = hash();
    await spend(brand, owner, "pattern_file", h);
    await spend(brand, owner, "marketing_media", h);
    await spend(brand, owner, "pattern_file", hash());
    expect(await balance(brand)).toBe(10 - 2 - 1 - 2);
  });

  it("refuses when the balance is short, and never lets it go below zero under parallel spends", async () => {
    const { owner, brand } = await fresh("Short Brand");
    await grant(brand, 5);
    const answers = await Promise.all(Array.from({ length: 6 }, () => spend(brand, owner, "pattern_file", hash())));
    expect(answers.filter((a) => a.ok === true)).toHaveLength(2);
    expect(answers.find((a) => a.ok === false)).toMatchObject({ reason: "insufficient" });
    expect(await balance(brand)).toBe(1);
  });

  it("refuses a user who is not in the brand", async () => {
    const { error } = await adminClient().rpc("credit_spend", {
      p_brand_id: aliceBrand, p_user_id: bob.userId, p_kind: "pattern_file", p_version_hash: hash(),
    });
    expect(error).not.toBeNull();
  });

  it("refuses an output with no price", async () => {
    const { error } = await adminClient().rpc("credit_spend", {
      p_brand_id: aliceBrand, p_user_id: alice.userId, p_kind: "free_thing", p_version_hash: hash(),
    });
    expect(error).not.toBeNull();
  });
});

describe("credit_refund_for_order", () => {
  it("gives back every spend on the version, only that version, and only once", async () => {
    const { owner, brand } = await fresh("Refund Brand");
    await grant(brand, 20);
    const ordered = hash();
    const other = hash();
    await spend(brand, owner, "techpack_pdf", ordered);
    await spend(brand, owner, "pattern_file", ordered);
    await spend(brand, owner, "techpack_pdf", other);
    expect(await balance(brand)).toBe(20 - 3 - 2 - 3);

    expect(await refundFor(brand, ordered)).toMatchObject({ refunded: 5 });
    expect(await balance(brand)).toBe(20 - 3);
    expect(await refundFor(brand, ordered)).toMatchObject({ refunded: 0 });
    expect(await refundFor(brand, ordered)).toMatchObject({ refunded: 0 });
    expect(await balance(brand)).toBe(20 - 3);
  });

  it("is safe when two orders arrive together", async () => {
    const { owner, brand } = await fresh("Race Refund Brand");
    await grant(brand, 10);
    const h = hash();
    await spend(brand, owner, "pattern_file", h);
    await Promise.all([refundFor(brand, h), refundFor(brand, h), refundFor(brand, h)]);
    expect(await balance(brand)).toBe(10);
  });

  it("does not touch another brand's spends on a version with the same hash", async () => {
    const h = hash();
    await grant(aliceBrand, 10);
    await grant(bobBrand, 10);
    await spend(aliceBrand, alice, "pattern_file", h);
    await spend(bobBrand, bob, "pattern_file", h);
    const bobBefore = await balance(bobBrand);
    await refundFor(aliceBrand, h);
    expect(await balance(bobBrand)).toBe(bobBefore);
  });
});

describe("credit_expire", () => {
  it("takes away no more than the balance and only once per key", async () => {
    const { brand } = await fresh("Expire Brand");
    await grant(brand, 4);
    expect(await rpc("credit_expire", { p_brand_id: brand, p_amount: 5, p_key: "e1", p_note: "" })).toMatchObject({ applied: false });
    expect(await rpc("credit_expire", { p_brand_id: brand, p_amount: 3, p_key: "e2", p_note: "" })).toMatchObject({ applied: true, balance: 1 });
    expect(await rpc("credit_expire", { p_brand_id: brand, p_amount: 3, p_key: "e2", p_note: "" })).toMatchObject({ applied: false, balance: 1 });
  });
});

describe("the balance is the sum of the lines", () => {
  it("holds after a mix of operations", async () => {
    const { owner, brand } = await fresh("Sum Brand");
    await grant(brand, 12);
    const h = hash();
    await spend(brand, owner, "techpack_pdf", h);
    await spend(brand, owner, "pattern_file", hash());
    await refundFor(brand, h);
    await rpc("credit_expire", { p_brand_id: brand, p_amount: 2, p_key: "x", p_note: "" });
    const rows = (await lines(brand)) as { amount: number }[];
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(await balance(brand));
  });
});

describe("the tables", () => {
  it("cannot be written to by the server's own key, a member or a visitor, except through the functions", async () => {
    const { owner, brand } = await fresh("Locked Brand");
    const row = { brand_id: brand, kind: "grant", amount: 5, idempotency_key: randomUUID() };
    expect((await adminClient().from("credit_ledger").insert(row)).error).not.toBeNull();
    expect((await owner.client.from("credit_ledger").insert(row)).error).not.toBeNull();
    expect((await anonClient().from("credit_ledger").insert(row)).error).not.toBeNull();
    expect((await owner.client.from("credit_prices").update({ credits: 0 }).eq("output_kind", "pattern_file")).error).not.toBeNull();
  });

  it("cannot have a line changed or removed", async () => {
    const { owner, brand } = await fresh("Append Only Brand");
    await grant(brand, 3);
    expect((await adminClient().from("credit_ledger").update({ amount: 99 }).eq("brand_id", brand)).error).not.toBeNull();
    expect((await adminClient().from("credit_ledger").delete().eq("brand_id", brand)).error).not.toBeNull();
    // The server's key holds only SELECT, so the database answers "permission denied" before the
    // append-only trigger is reached; either way the line stays as it was.
    expect((await owner.client.from("credit_ledger").update({ amount: 99 }).eq("brand_id", brand)).error).not.toBeNull();
    expect((await owner.client.from("credit_ledger").delete().eq("brand_id", brand)).error).not.toBeNull();
    expect((await anonClient().from("credit_ledger").delete().eq("brand_id", brand)).error).not.toBeNull();
    expect(await balance(brand)).toBe(3);
    expect(await lines(brand)).toHaveLength(1);
  });

  it("lets a member read their brand's lines and no one else's", async () => {
    await grant(aliceBrand, 1);
    await grant(bobBrand, 1);
    const own = must(await alice.client.from("credit_ledger").select("brand_id"));
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r: { brand_id: string }) => r.brand_id !== bobBrand)).toBe(true);
    // Visitors hold no privilege on the table at all, so the database answers "permission denied".
    expect((await anonClient().from("credit_ledger").select("id")).error).not.toBeNull();
  });

  it("lets signed-in users read the price list, and visitors not", async () => {
    expect(must(await alice.client.from("credit_prices").select("output_kind")).length).toBe(3);
    expect((await anonClient().from("credit_prices").select("output_kind")).error).not.toBeNull();
  });

  it("refuses to set a price for an unknown output or a price that is not a whole number", async () => {
    expect((await adminClient().rpc("credit_set_prices", { p_prices: { invented: 1 }, p_placeholder: true })).error).not.toBeNull();
    expect((await adminClient().rpc("credit_set_prices", { p_prices: { pattern_file: 1.5 }, p_placeholder: true })).error).not.toBeNull();
  });

  it("cannot be run by a browser", async () => {
    expect((await alice.client.rpc("credit_grant", { p_brand_id: aliceBrand, p_amount: 100, p_key: "x" })).error).not.toBeNull();
    expect((await alice.client.rpc("credit_balance", { p_brand_id: aliceBrand })).error).not.toBeNull();
  });
});
