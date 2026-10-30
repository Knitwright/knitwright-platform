import { describe, expect, it } from "vitest";
import { readAddress, withEditorState, writeForm } from "./index";

/** The editor's state in the address: a reload or a shared link opens the same design in the same state. */

describe("readAddress", () => {
  it("reads the rail, the views, the size and the form", () => {
    const state = readAddress({ rail: "specs", view: "3d", beside: "2d", size: "L", opt: ["collar:C02", "sleeve_finish:K02"], par: "body_length_offset:20" }, "2d");

    expect(state).toEqual({
      segment: "specs",
      view: "3d",
      beside: "2d",
      size: "L",
      options: { collar: "C02", sleeve_finish: "K02" },
      parameters: { body_length_offset: "20" },
    });
  });

  it("falls back to the view the design opens in, with nothing else set", () => {
    expect(readAddress({}, "3d")).toEqual({ segment: "form", view: "3d", beside: null, size: null, options: {}, parameters: {} });
  });

  it("drops a pair with no key or no value", () => {
    expect(readAddress({ opt: ["collar", ":C02", "collar:", "sleeve_finish:K02"] }, "2d").options).toEqual({ sleeve_finish: "K02" });
  });

  it("takes the first of a parameter given twice", () => {
    expect(readAddress({ size: ["L", "XL"] }, "2d").size).toBe("L");
  });
});

describe("writeForm", () => {
  it("writes the pairs in key order, so the same form gives the same address", () => {
    const written = writeForm({ options: { sleeve_finish: "K02", collar: "C02" }, parameters: { sleeve_length_offset: 10, body_length_offset: -20 } });

    expect(written.opt).toEqual(["collar:C02", "sleeve_finish:K02"]);
    expect(written.par).toEqual(["body_length_offset:-20", "sleeve_length_offset:10"]);
  });
});

describe("withEditorState", () => {
  const form = { options: { collar: "C02" }, parameters: { body_length_offset: 20 } };

  it("keeps every other parameter of the address", () => {
    const query = withEditorState("?tool=sizes&colourway=home", { segment: "form", view: "3d", beside: null, size: "L", form });

    expect(new URLSearchParams(query).get("tool")).toBe("sizes");
    expect(new URLSearchParams(query).get("colourway")).toBe("home");
    expect(new URLSearchParams(query).getAll("opt")).toEqual(["collar:C02"]);
    expect(new URLSearchParams(query).getAll("par")).toEqual(["body_length_offset:20"]);
  });

  it("takes the second view and the size out again when they are not set", () => {
    const query = withEditorState("?view=2d&beside=3d&size=L", { segment: "form", view: "2d", beside: null, size: null, form });

    expect(new URLSearchParams(query).get("beside")).toBeNull();
    expect(new URLSearchParams(query).get("size")).toBeNull();
  });

  it("replaces the form it finds rather than adding to it", () => {
    const once = withEditorState("", { segment: "form", view: "2d", beside: null, size: null, form });
    const twice = withEditorState(once, { segment: "form", view: "2d", beside: null, size: null, form: { options: { collar: "C03" }, parameters: {} } });

    expect(new URLSearchParams(twice).getAll("opt")).toEqual(["collar:C03"]);
    expect(new URLSearchParams(twice).getAll("par")).toEqual([]);
  });

  it("round-trips through readAddress", () => {
    const query = withEditorState("", { segment: "specs", view: "tech-pack", beside: "2d", size: "XL", form });
    const read = readAddress(Object.fromEntries(new URLSearchParams(query)), "2d");

    expect(read).toMatchObject({ segment: "specs", view: "tech-pack", beside: "2d", size: "XL" });
  });
});
