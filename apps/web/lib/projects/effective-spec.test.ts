import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { SpecAction } from "@/lib/garment";
import { colourAction } from "./colour-controls";
import { effectiveSpec, pendingRequests, resolveRequest } from "./effective-spec";
import { initialEditorState, editorReducer, type Request } from "./editor-state";

const colour = (spec: ReturnType<typeof start>, panel: string, swatch: string): Request => {
  const request = colourAction(spec, panel, { swatch });
  if (request.kind !== "action") throw new Error("Expected an action");
  return request;
};

describe("effectiveSpec", () => {
  const spec = start("crew-tee");

  it("is the design itself when nothing is waiting", () => {
    expect(effectiveSpec(spec, [])).toBe(spec);
  });

  it("applies waiting changes in order, so a second colour change keeps the first", () => {
    const first = colour(spec, "body-front", "#111111");
    const afterFirst = effectiveSpec(spec, [first]);
    const second = colour(afterFirst, "body-back", "#222222");
    const both = effectiveSpec(spec, [first, second]);
    expect(both.colourways[0].colours.map((entry) => entry.panelId)).toEqual(["body-front", "body-back"]);
  });

  it("skips a change the rules refuse and keeps going", () => {
    const refused: Request = { kind: "action", action: { type: "remove-artwork", id: "nothing-here" } as SpecAction };
    const first = colour(spec, "body-front", "#111111");
    expect(effectiveSpec(spec, [refused, first]).colourways[0].colours).toHaveLength(1);
  });

  it("does not change the design it is given", () => {
    const frozen = JSON.stringify(spec);
    effectiveSpec(spec, [colour(spec, "body-front", "#111111")]);
    expect(JSON.stringify(spec)).toBe(frozen);
  });
});

describe("pendingRequests", () => {
  it("lists what was saved but not shown, the change on its way and the changes waiting, oldest first", () => {
    const spec = start("crew-tee");
    const a = colour(spec, "body-front", "#111111");
    const b = colour(spec, "body-back", "#222222");
    let state = initialEditorState(1);
    state = editorReducer(state, { type: "enqueue", key: "colour:body-front", request: a, focus: false });
    state = editorReducer(state, { type: "start", spec });
    state = editorReducer(state, { type: "enqueue", key: "colour:body-back", request: b, focus: false });
    state = editorReducer(state, { type: "enqueue", key: "history", request: { kind: "undo" }, focus: true });
    expect(pendingRequests(state, 1)).toEqual([a, b, { kind: "undo" }]);
    expect(pendingRequests(initialEditorState(1), 1)).toEqual([]);

    state = editorReducer(state, { type: "succeeded", id: state.inFlight!.id, version: 2, dropped: [] });
    expect(pendingRequests(state, 1)).toEqual([a, b, { kind: "undo" }]);
    // Once the page shows version 2, the saved colour is part of its design and is not counted again.
    expect(pendingRequests(state, 2)).toEqual([b, { kind: "undo" }]);
  });
});

describe("resolveRequest", () => {
  const spec = start("crew-tee");

  it("sends an ordinary change as it is", () => {
    const undo: Request = { kind: "undo" };
    expect(resolveRequest(null, undo)).toEqual({ kind: "ready", request: undo });
  });

  it("cannot work out a colour without a design", () => {
    expect(resolveRequest(null, { kind: "colour", panelId: "body-front", change: { swatch: "#111111" } }).kind).toBe("problem");
  });

  it("works out a colour on top of the design given", () => {
    const resolved = resolveRequest(spec, { kind: "colour", panelId: "body-front", change: { swatch: "#111111" } });
    expect(resolved).toMatchObject({ kind: "ready", request: { kind: "action", action: { type: "update-colourway" } } });
  });

  it("says why a colour cannot be used", () => {
    const resolved = resolveRequest(spec, { kind: "colour", panelId: "body-front", change: { swatch: "blue" } });
    expect(resolved).toEqual({ kind: "problem", reason: "Pick a colour, such as #1b2a49." });
  });
});
