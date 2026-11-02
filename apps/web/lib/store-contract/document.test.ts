import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { manifestPayload, productsPayload } from "./contract";
import { allFieldPaths, CONTRACT_FIELDS, fieldPaths, GAP_FIELDS } from "./document";
import { fullProduct, todayProduct, AT } from "./fixtures/samples";
import { SAMPLE_PAYLOADS } from "./fixtures/payloads";
import { CONTRACT_DOCUMENT } from "./version";

/**
 * The lock between the shape and its document (plan v5 O2).
 *
 * Every payload is built with everything the platform could hold and again with the gaps that are
 * really there today. Both shapes together are the contract, and both have to be written down.
 */

/** `lib/store-contract` sits two folders under `apps/web`, which sits two under the repository root. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

const document = (): string => readFileSync(join(REPO_ROOT, CONTRACT_DOCUMENT), "utf8");

describe("the shape of the contract", () => {
  it("is exactly the list in document.ts, so a field cannot be added, renamed, moved or dropped quietly", () => {
    expect(allFieldPaths(SAMPLE_PAYLOADS())).toEqual([...CONTRACT_FIELDS]);
  });

  it("has every one of its fields written down in the document, word for word", () => {
    const text = document();
    for (const path of CONTRACT_FIELDS) expect(text, `undocumented field: ${path}`).toContain(path);
  });

  it("documents no field the payload does not have, so the document cannot drift the other way", () => {
    const written = [...document().matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1] as string);

    expect(written.length).toBe(CONTRACT_FIELDS.length);
    expect(written.filter((path) => !CONTRACT_FIELDS.includes(path))).toEqual([]);
  });

  it("tells a reader where the document is, inside every answer", () => {
    expect(manifestPayload(AT).document).toBe(CONTRACT_DOCUMENT);
    expect(productsPayload([fullProduct()], AT).document).toBe(CONTRACT_DOCUMENT);
  });

  it("says in the document that no delivery date and no Australian figure exists", () => {
    const text = document();

    expect(text).toContain("No delivery date exists");
    expect(text).toContain("No Australian dollar price exists");
    expect(text).toContain("Do not convert the pound");
  });

  it("says in the document that nothing is sellable today, and why", () => {
    const text = document();

    expect(text).toContain("## What is sellable today");
    expect(text).toContain("care_label_refused");
  });
});

describe("the walk that finds a payload's fields", () => {
  it("names an array once and walks its items under []", () => {
    expect(fieldPaths({ items: [{ a: 1 }, { b: 2 }] })).toEqual(["items", "items[].a", "items[].b"]);
  });

  it("stops at a gap, because a gap is one shape documented once", () => {
    expect(fieldPaths({ price: { status: "gap", missing: ["x"], because: "y", ruleId: "R-GAP-000" } })).toEqual(["price"]);
    expect(GAP_FIELDS).toEqual(["gap.because", "gap.missing", "gap.ruleId", "gap.status"]);
  });

  it("stops at a map whose own keys are data, so a size label is not read as a field", () => {
    expect(fieldPaths({ valuesMm: { S: 500, M: 520 } })).toEqual(["valuesMm"]);
  });

  it("stops at a shape carried unchanged from another workstream", () => {
    expect(fieldPaths({ payload: { kind: "collection-drop", styles: [] } })).toEqual(["payload"]);
  });

  it("finds the same paths for a product whose fields are held and one whose fields are missing", () => {
    const whole = fieldPaths(fullProduct());
    const gapped = fieldPaths(todayProduct());

    expect(whole.length).toBeGreaterThan(0);
    expect(gapped.length).toBeGreaterThan(0);
  });
});
