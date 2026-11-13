import { describe, expect, it } from "vitest";
import { DEFAULT_RETURNS_POLICY, EU_PERSON_NEEDED, gpsrRows, paragraphsOf } from "./policy";

describe("the returns policy and product safety", () => {
  it("starts from the spec's words: defects only for personalised, 14 days for standard sizes, 30 days for defects", () => {
    const parts = paragraphsOf(DEFAULT_RETURNS_POLICY);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("personalised items cannot be returned except for defects");
    expect(parts[1]).toContain("14-day");
    expect(parts[2]).toContain("30 days");
    expect(paragraphsOf("one\n \n\ntwo\n")).toEqual(["one", "two"]);
  });

  it("fills in the manufacturer from the factory row and asks for the EU responsible person", () => {
    const rows = gpsrRows({ factory: { name: "Partner factory", country: "Sialkot, PK" }, euResponsiblePerson: null });
    expect(rows.map((row) => [row.id, row.state])).toEqual([["manufacturer", "done"], ["eu-person", "needed"], ["safety", "done"]]);
    expect(rows[0]!.value).toBe("Partner factory, Sialkot, PK");
    expect(rows[1]!.value).toBe(EU_PERSON_NEEDED);
    const done = gpsrRows({ factory: null, euResponsiblePerson: "EU Rep GmbH" });
    expect(done[0]!.state).toBe("needed");
    expect(done[1]).toMatchObject({ value: "EU Rep GmbH", state: "done" });
  });
});
