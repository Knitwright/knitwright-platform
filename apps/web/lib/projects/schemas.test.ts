import { describe, expect, it } from "vitest";
import {
  MAX_VERSION,
  applyDesignActionSchema,
  createProjectSchema,
  projectDetailsSchema,
  designIdSchema,
  restoreVersionSchema,
  undoDesignSchema,
} from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const valid = { typeId: "crew-tee", wearer: "women", name: "Home shirt" };

describe("createProjectSchema", () => {
  it("accepts a name, a type and a wearer, and leaves the style number and season empty", () => {
    expect(createProjectSchema.parse(valid)).toEqual({ ...valid, styleNumber: "", season: "" });
  });

  it("trims the text", () => {
    const parsed = createProjectSchema.parse({ ...valid, name: "  Away  ", styleNumber: " A1 ", season: " SS27 " });

    expect(parsed).toMatchObject({ name: "Away", styleNumber: "A1", season: "SS27" });
  });

  it.each([
    ["an empty name", { name: "   " }, "name", "A design name has 1 to 80 characters."],
    ["a long name", { name: "n".repeat(81) }, "name", "A design name has 1 to 80 characters."],
    ["a long style number", { styleNumber: "s".repeat(41) }, "styleNumber", "Use 40 characters or fewer."],
    ["a long season", { season: "s".repeat(41) }, "season", "Use 40 characters or fewer."],
    ["no wearer", { wearer: "" }, "wearer", "Choose who it is for."],
    ["an unknown wearer", { wearer: "dogs" }, "wearer", "Choose who it is for."],
    ["no type", { typeId: "" }, "typeId", "Choose a garment type."],
    ["a type not offered yet", { typeId: "sports-bra" }, "typeId", "Not offered yet: Sports bra. Choose another garment."],
  ])("refuses %s beside the right field", (_label, patch, field, message) => {
    const result = createProjectSchema.safeParse({ ...valid, ...patch });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
    }
  });

  it("refuses hidden characters in the style number", () => {
    expect(createProjectSchema.safeParse({ ...valid, styleNumber: "A\nB" }).success).toBe(false);
  });
});

describe("projectDetailsSchema", () => {
  it("needs the design's id and its details", () => {
    expect(projectDetailsSchema.parse({ projectId: ID, name: "New", styleNumber: "", season: "" })).toEqual({
      projectId: ID,
      name: "New",
      styleNumber: "",
      season: "",
    });
    expect(projectDetailsSchema.safeParse({ name: "New" }).success).toBe(false);
  });
});

describe("applyDesignActionSchema", () => {
  it("needs the design, the version the person is looking at, and a change", () => {
    const input = { projectId: ID, expectedVersion: 3, action: { type: "change-wearer", wearer: "men" } };

    expect(applyDesignActionSchema.parse(input)).toEqual(input);
  });

  it.each([0, -1, 1.5, "3", MAX_VERSION + 1, 1e12, Number.NaN])("refuses the version %j", (expectedVersion) => {
    expect(applyDesignActionSchema.safeParse({ projectId: ID, expectedVersion, action: {} }).success).toBe(false);
  });

  it("accepts the largest version the database can hold", () => {
    expect(applyDesignActionSchema.safeParse({ projectId: ID, expectedVersion: MAX_VERSION, action: {} }).success).toBe(true);
    expect(MAX_VERSION).toBe(2147483647);
  });

  it.each(["abc", "", "not-an-id", "11111111-1111-4111-8111-11111111111"])("refuses the design id %j", (projectId) => {
    expect(applyDesignActionSchema.safeParse({ projectId, expectedVersion: 1, action: {} }).success).toBe(false);
  });
});

describe("restoreVersionSchema", () => {
  it("needs a version to go back to as well", () => {
    expect(restoreVersionSchema.parse({ projectId: ID, expectedVersion: 4, version: 2 })).toEqual({
      projectId: ID,
      expectedVersion: 4,
      version: 2,
    });
    expect(restoreVersionSchema.safeParse({ projectId: ID, expectedVersion: 4, version: 0 }).success).toBe(false);
    expect(restoreVersionSchema.safeParse({ projectId: ID, expectedVersion: 4, version: MAX_VERSION + 1 }).success).toBe(false);
  });
});

describe("designIdSchema", () => {
  it("needs a design id", () => {
    expect(designIdSchema.parse({ projectId: ID })).toEqual({ projectId: ID });
    expect(designIdSchema.safeParse({ projectId: "abc" }).success).toBe(false);
    expect(designIdSchema.safeParse({}).success).toBe(false);
  });
});

describe("undoDesignSchema", () => {
  it("needs the design and the version the person is looking at", () => {
    expect(undoDesignSchema.parse({ projectId: ID, expectedVersion: 3 })).toEqual({ projectId: ID, expectedVersion: 3 });
    expect(undoDesignSchema.safeParse({ projectId: "abc", expectedVersion: 3 }).success).toBe(false);
    expect(undoDesignSchema.safeParse({ projectId: ID, expectedVersion: MAX_VERSION + 1 }).success).toBe(false);
  });
});
