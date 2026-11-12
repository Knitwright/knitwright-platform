import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSION_STATUSES } from "@/lib/validation/status";
import { DESIGN_STATUSES, designStatusSchema } from "./validation";

/**
 * Plan v6 D1 (decision 0132): the contract's list of design statuses lacked `approved`, which the database has held
 * since migration 20261101030000 and `lib/validation/status.ts` since plan v5 X4. A contract reader parsing a status
 * row of an approved version failed. These keep the three lists one list.
 */

const migration = readFileSync(new URL("../../../../../supabase/migrations/20261101030000_design_validation_v2.sql", import.meta.url), "utf8");

/** The statuses the database's check constraint allows, in the order it lists them. */
const databaseStatuses = (): readonly string[] => {
  const constraint = /add constraint design_statuses_status_check\s+check \(status in \(([^)]*)\)\)/.exec(migration)?.[1] ?? "";
  return [...constraint.matchAll(/'([a-z]+)'/g)].map((found) => found[1] ?? "");
};

describe("the design statuses of the production contract", () => {
  it("are the four of spec F-0, in order", () => {
    expect(DESIGN_STATUSES).toEqual(["draft", "validated", "approved", "ordered"]);
  });

  it("agree with the database's check constraint", () => {
    expect(databaseStatuses()).toEqual([...DESIGN_STATUSES]);
  });

  it("agree with the status rules of lib/validation", () => {
    expect([...VERSION_STATUSES]).toEqual([...DESIGN_STATUSES]);
  });

  it("read an approved version's row", () => {
    expect(designStatusSchema.parse("approved")).toBe("approved");
  });
});
