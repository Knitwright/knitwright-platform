import { describe, expect, it } from "vitest";
import { initialEditorState, type Change, type EditorState } from "./editor-state";
import { isSaving } from "./saving-key";

const change = (key: string, id = 1): Change => ({ id, key, request: { kind: "undo" }, focus: true });

describe("isSaving", () => {
  const idle: EditorState = initialEditorState(3);

  it("is false while nothing is waiting or on its way", () => {
    expect(isSaving(idle, "confirm:a")).toBe(false);
  });

  it("is true for the control whose change is on its way, and for no other", () => {
    const state: EditorState = { ...idle, inFlight: { ...change("confirm:a"), expectedVersion: 3 } };
    expect(isSaving(state, "confirm:a")).toBe(true);
    expect(isSaving(state, "confirm:b")).toBe(false);
  });

  it("is true for a control whose change waits its turn", () => {
    const state: EditorState = { ...idle, queue: [change("confirm:a"), change("confirm:b", 2)] };
    expect(isSaving(state, "confirm:b")).toBe(true);
    expect(isSaving(state, "confirm:c")).toBe(false);
  });
});
