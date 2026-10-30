import { describe, expect, it } from "vitest";
import { editorPageState } from "./index";
import { bare, jersey } from "./fixtures/article";

/** What the editor's page works out before it draws anything. */

const sizing = { sizes: ["S", "M", "L"], baseSize: "M" };

describe("the state of the editor's page", () => {
  it("opens a base article the drafter can draw in 3D, with the model built for the shown size", () => {
    const state = editorPageState({ query: {}, article: jersey(), sizing });

    expect(state).toMatchObject({ segment: "form", view: "3d", beside: null, size: "M" });
    expect(state.draft?.kind).toBe("drafted");
    expect(state.model?.layout.size).toBe("M");
  });

  it("opens 2D for an article the drafter cannot draw yet, and builds no model", () => {
    const state = editorPageState({ query: {}, article: bare(), sizing });

    expect(state.view).toBe("2d");
    expect(state.draft).toMatchObject({ kind: "not-drafted-yet" });
    expect(state.model).toBeNull();
  });

  it("opens 2D and drafts nothing for a design with no base article", () => {
    const state = editorPageState({ query: {}, article: null, sizing });

    expect(state).toMatchObject({ view: "2d", draft: null, model: null });
    expect(state.form).toEqual({ options: {}, parameters: {} });
  });

  it("builds no model while the 3D view is not on the canvas, so the page does not carry it", () => {
    const state = editorPageState({ query: { view: "2d" }, article: jersey(), sizing });

    expect(state.view).toBe("2d");
    expect(state.model).toBeNull();
    expect(state.draft?.kind).toBe("drafted");
  });

  it("builds the model for a side-by-side canvas that includes 3D", () => {
    const state = editorPageState({ query: { view: "2d", beside: "3d" }, article: jersey(), sizing });

    expect(state.beside).toBe("3d");
    expect(state.model).not.toBeNull();
  });

  it("drafts the size and form the address asks for", () => {
    const state = editorPageState({ query: { size: "L", opt: "collar:C01", par: "body_length_offset:20" }, article: jersey(), sizing });

    expect(state.size).toBe("L");
    expect(state.form.options.collar).toBe("C01");
    expect(state.form.parameters.body_length_offset).toBe(20);
    expect(state.model?.layout.size).toBe("L");
  });

  it("falls back to 2D and names the reason for an option whose shape the article does not define", () => {
    const state = editorPageState({ query: { opt: "collar:C03" }, article: jersey(), sizing });

    expect(state.form.options.collar).toBe("C03");
    expect(state.view).toBe("2d");
    expect(state.draft).toMatchObject({ kind: "not-drafted-yet" });
    expect(state.model).toBeNull();
  });

  it("keeps the form inside the approved range, whatever the address says", () => {
    const state = editorPageState({ query: { par: "body_length_offset:5000", opt: "collar:C99" }, article: jersey(), sizing });

    expect(state.form.parameters.body_length_offset).toBe(0);
    expect(state.form.options.collar).toBe("C01");
    expect(state.draft?.kind).toBe("drafted");
  });

  it("offers the article's own size range for a design that has set none", () => {
    const state = editorPageState({ query: {}, article: jersey(), sizing: null });

    expect(state.sizes).toEqual(jersey().sizeRange);
    expect(state.size).toBe(jersey().sampleSize);
  });

  it("opens the toolbar the address names", () => {
    expect(editorPageState({ query: { rail: "specs" }, article: null, sizing }).segment).toBe("specs");
  });
});
