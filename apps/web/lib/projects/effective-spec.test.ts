import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { SpecAction } from "@/lib/garment";
import { colourAction } from "./colour-controls";
import { effectiveSpec, pendingActions } from "./effective-spec";
import { initialEditorState, editorReducer } from "./editor-state";

const colour = (spec: ReturnType<typeof start>, panel: string, swatch: string): SpecAction => {
  const request = colourAction(spec, panel, { swatch });
  if (request.kind !== "action") throw new Error("Expected an action");
  return request.action;
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
    const refused: SpecAction = { type: "remove-artwork", id: "nothing-here" };
    const first = colour(spec, "body-front", "#111111");
    expect(effectiveSpec(spec, [refused, first]).colourways[0].colours).toHaveLength(1);
  });

  it("does not change the design it is given", () => {
    const frozen = JSON.stringify(spec);
    effectiveSpec(spec, [colour(spec, "body-front", "#111111")]);
    expect(JSON.stringify(spec)).toBe(frozen);
  });
});

describe("pendingActions", () => {
  it("lists the change on its way and the changes waiting, oldest first, and ignores undo and restore", () => {
    const spec = start("crew-tee");
    const a = colour(spec, "body-front", "#111111");
    const b = colour(spec, "body-back", "#222222");
    let state = initialEditorState(1);
    state = editorReducer(state, { type: "enqueue", key: "colour:body-front", request: { kind: "action", action: a }, focus: false });
    state = editorReducer(state, { type: "start" });
    state = editorReducer(state, { type: "enqueue", key: "colour:body-back", request: { kind: "action", action: b }, focus: false });
    state = editorReducer(state, { type: "enqueue", key: "history", request: { kind: "undo" }, focus: true });
    expect(pendingActions(state)).toEqual([a, b]);
    expect(pendingActions(initialEditorState(1))).toEqual([]);
  });

  it("lists every change of a batch in its order, and a newer batch for the same control replaces the older", () => {
    const spec = start("crew-tee");
    const a = colour(spec, "body-front", "#111111");
    const b = colour(spec, "body-back", "#222222");
    let state = initialEditorState(1);
    state = editorReducer(state, { type: "enqueue", key: "confirm:all", request: { kind: "actions", actions: [a] }, focus: true });
    state = editorReducer(state, { type: "enqueue", key: "confirm:all", request: { kind: "actions", actions: [a, b] }, focus: true });
    expect(pendingActions(state)).toEqual([a, b]);
  });
});
