import { describe, expect, it } from "vitest";
import { buildSignOff, NOBODY_HAS_CHECKED } from "./sign-off";

const record = (role: "pattern" | "print" | "production" | "club", name: string) => ({ role, name, date: "3 Oct 2026", dateIso: "2026-10-03" });

describe("the sign-off with records", () => {
  it("is empty and says nobody has checked, with no records", () => {
    const section = buildSignOff();
    expect(section.statement).toBe(NOBODY_HAS_CHECKED);
    expect(section.lines.map((line) => line.role)).toEqual(["Pattern", "Print", "Production", "Club"]);
  });

  it("fills a line only from the record of a named person, with their date", () => {
    const section = buildSignOff([record("print", "Ana Reyes"), record("club", "Sam Lee")]);
    expect(section.lines.find((line) => line.role === "Print")).toMatchObject({ name: { value: "Ana Reyes", provenance: "user-edited" }, date: { value: "3 Oct 2026" } });
    expect(section.lines.find((line) => line.role === "Pattern")?.name).toEqual({ status: "to-be-confirmed" });
    expect(section.statement).toBe("Signed by 2 of 4 roles. No strike-off has been accepted.");
  });

  it("records the strike-off with who accepted it and when", () => {
    const section = buildSignOff([], { name: "Sam Lee", date: "9 Oct 2026", dateIso: "2026-10-09", result: "Shrink 2.0 % and colour matched" });
    expect(section.strikeOff).toMatchObject({ acceptedBy: { value: "Sam Lee" }, date: { value: "9 Oct 2026" }, result: { value: "Shrink 2.0 % and colour matched" } });
    expect(section.statement).toBe("Signed by 0 of 4 roles. The strike-off was accepted by Sam Lee on 9 Oct 2026.");
    expect(buildSignOff([], { name: "A", date: "d", dateIso: "i", result: null }).strikeOff.result).toEqual({ status: "to-be-confirmed" });
  });
});
