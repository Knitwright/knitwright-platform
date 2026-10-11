import { describe, expect, it } from "vitest";
import { QUANTITY_MAX, describeQuote, firstAllowedDate, quoteRequestSchemaAt, quoteStatusLabel } from "./quote";

const NOW = new Date("2026-10-11T09:00:00Z");
const schema = quoteRequestSchemaAt(() => NOW);
const PROJECT = "7b0c3f8e-8f43-4a43-9b52-2d7c1f1d4a10";

const form = (overrides: Record<string, string> = {}) => ({
  projectId: PROJECT,
  version: "3",
  quantity: "120",
  neededBy: "2026-12-01",
  ...overrides,
});

const problem = (overrides: Record<string, string>) => schema.safeParse(form(overrides)).error?.issues[0];

describe("quoteRequestSchemaAt", () => {
  it("takes a whole quantity, a future date and optional notes", () => {
    expect(schema.parse(form({ sizesNote: " 10 S, 20 M ", message: "" }))).toEqual({
      projectId: PROJECT,
      version: 3,
      quantity: 120,
      neededBy: "2026-12-01",
      sizesNote: "10 S, 20 M",
      message: "",
    });
  });

  it("refuses a quantity that is not a whole number from 1", () => {
    for (const quantity of ["0", "-5", "2.5", "lots", ""]) {
      expect(problem({ quantity })).toMatchObject({ path: ["quantity"], message: "Enter a whole number from 1." });
    }
    expect(problem({ quantity: String(QUANTITY_MAX + 1) })?.path).toEqual(["quantity"]);
  });

  it("refuses today, a past date and a date that does not exist", () => {
    for (const neededBy of ["2026-10-11", "2026-01-01", "2026-02-30", "soon"]) {
      expect(problem({ neededBy })?.path).toEqual(["neededBy"]);
    }
    expect(problem({ neededBy: "2026-10-11" })?.message).toBe("Choose a date after today.");
  });

  it("refuses notes that are too long", () => {
    expect(problem({ sizesNote: "x".repeat(501) })?.path).toEqual(["sizesNote"]);
    expect(problem({ message: "x".repeat(1001) })?.path).toEqual(["message"]);
  });
});

describe("quoteStatusLabel", () => {
  it("says each status in plain words", () => {
    expect(quoteStatusLabel("new")).toBe("Waiting for a reply");
    expect(quoteStatusLabel("quoted")).toBe("Quote sent");
    expect(quoteStatusLabel("closed")).toBe("Closed");
  });
});

describe("firstAllowedDate", () => {
  it("is tomorrow in UTC, across the end of a month and a year", () => {
    expect(firstAllowedDate(NOW)).toBe("2026-10-12");
    expect(firstAllowedDate(new Date("2026-12-31T23:59:00Z"))).toBe("2027-01-01");
  });
});

describe("describeQuote", () => {
  it("says a request in one line", () => {
    expect(describeQuote({ quantity: 120, neededBy: "2026-12-01", status: "new" })).toBe(
      "120 pieces, needed by 1 Dec 2026. Waiting for a reply.",
    );
    expect(describeQuote({ quantity: 1, neededBy: "2027-01-05", status: "quoted" })).toBe("1 piece, needed by 5 Jan 2027. Quote sent.");
  });
});
