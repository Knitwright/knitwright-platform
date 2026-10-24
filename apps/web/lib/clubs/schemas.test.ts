import { describe, expect, it } from "vitest";
import { applyKitBody, inviteBody, roleBody, rosterBody, rosterImportBody, seasonBody } from "./schemas";

const ID = "6f1c1b0e-6a39-4b0e-8f0e-2b6a1d2f3c4d";

describe("club request bodies", () => {
  it("reads a season and refuses one that ends before it starts", () => {
    expect(seasonBody.parse({ name: " 2027 " }).startsOn).toBeNull();
    expect(seasonBody.safeParse({ name: "x", startsOn: "2027-05-01", endsOn: "2027-04-01" }).success).toBe(false);
    expect(seasonBody.safeParse({ name: "", }).success).toBe(false);
    expect(seasonBody.safeParse({ name: "x", startsOn: "tomorrow" }).success).toBe(false);
  });

  it("offers only the roles that can be given", () => {
    expect(roleBody.safeParse({ role: "owner" }).success).toBe(false);
    expect(roleBody.safeParse({ role: "viewer" }).success).toBe(true);
    expect(inviteBody.parse({ email: " Ann@Example.COM ", role: "admin" }).email).toBe("ann@example.com");
    expect(inviteBody.safeParse({ email: "nope", role: "admin" }).success).toBe(false);
  });

  it("reads a roster and an import", () => {
    expect(rosterBody.safeParse({ players: [{ name: "A", number: "1", sizeLabel: "M", wearerGroup: "mens" }] }).success).toBe(true);
    expect(rosterBody.safeParse({ players: [{ name: "A", number: "1", sizeLabel: "M" }] }).success).toBe(false);
    expect(rosterImportBody.safeParse({ csv: "" }).success).toBe(false);
    expect(rosterImportBody.safeParse({ csv: "a,b", mapping: { number: 1 } }).success).toBe(true);
  });

  it("needs a design, its version and something to apply", () => {
    expect(applyKitBody.safeParse({ projectId: ID, expectedVersion: 1, parts: ["colours"] }).success).toBe(true);
    expect(applyKitBody.safeParse({ projectId: ID, expectedVersion: 1, parts: [] }).success).toBe(false);
    expect(applyKitBody.safeParse({ projectId: ID, expectedVersion: 0, parts: ["crest"] }).success).toBe(false);
    expect(applyKitBody.safeParse({ projectId: ID, expectedVersion: 1, parts: ["logo"] }).success).toBe(false);
  });
});
