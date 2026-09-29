import { describe, expect, it } from "vitest";
import type { SpecAction } from "@/lib/garment";
import {
  canStart,
  editorReducer,
  initialEditorState,
  isBusy,
  shownChoice,
  type EditorEvent,
  type EditorState,
  type Request,
} from "./editor-state";

const option = (optionId: string, choiceId: string): Request => ({
  kind: "action",
  action: { type: "set-option", optionId, choiceId, provenance: "user-edited" } as SpecAction,
});

const run = (events: readonly EditorEvent[], from: EditorState = initialEditorState(1)): EditorState =>
  events.reduce(editorReducer, from);

const enqueue = (key: string, request: Request = option("fit", "slim"), focus = false): EditorEvent => ({
  type: "enqueue",
  key,
  request,
  focus,
});

const succeeded = (id: number, version: number): EditorEvent => ({ type: "succeeded", id, version, dropped: [] });
const failed = (id: number, message = "No.", code = "invalid_input"): EditorEvent => ({ type: "failed", id, code, message });

describe("the queue", () => {
  it("sends changes one at a time, each at the latest version", () => {
    let state = run([enqueue("a"), enqueue("b"), { type: "start" }]);
    expect(state.inFlight).toMatchObject({ key: "a", expectedVersion: 1 });
    expect(state.queue.map((change) => change.key)).toEqual(["b"]);

    state = run([{ type: "start" }], state);
    expect(state.inFlight?.key).toBe("a");

    state = run([succeeded(state.inFlight!.id, 2), { type: "start" }], state);
    expect(state.inFlight).toMatchObject({ key: "b", expectedVersion: 2 });
  });

  it("does not start anything when the queue is empty", () => {
    expect(canStart(initialEditorState(1))).toBe(false);
    expect(run([{ type: "start" }]).inFlight).toBeNull();
  });

  it("keeps sending after a change in the middle is refused", () => {
    let state = run([enqueue("a"), enqueue("b"), enqueue("c"), { type: "start" }]);
    state = run([succeeded(state.inFlight!.id, 2), { type: "start" }], state);
    state = run([failed(state.inFlight!.id, "That combination cannot be made."), { type: "start" }], state);

    expect(state.problems.b).toMatchObject({ message: "That combination cannot be made." });
    expect(state.inFlight).toMatchObject({ key: "c", expectedVersion: 2 });
    expect(state.conflict).toBeNull();
  });

  it("lets the later of two changes to one control win, and sends one save", () => {
    const state = run([enqueue("fit", option("fit", "slim")), enqueue("hem", option("hem-shape", "curved")), enqueue("fit", option("fit", "relaxed"))]);

    expect(state.queue.map((change) => change.key)).toEqual(["hem", "fit"]);
    expect(state.queue[1].request).toEqual(option("fit", "relaxed"));
  });

  it("does not drop a change that is already on its way", () => {
    let state = run([enqueue("fit", option("fit", "slim")), { type: "start" }]);
    state = run([enqueue("fit", option("fit", "relaxed"))], state);

    expect(state.inFlight?.request).toEqual(option("fit", "slim"));
    expect(state.queue).toHaveLength(1);
  });

  it("keeps undo and restore requests, however many", () => {
    const state = run([enqueue("history", { kind: "undo" }), enqueue("history", { kind: "undo" })]);

    expect(state.queue).toHaveLength(2);
  });

  it("is busy while anything is waiting or on its way", () => {
    expect(isBusy(initialEditorState(1))).toBe(false);
    expect(isBusy(run([enqueue("a")]))).toBe(true);
    expect(isBusy(run([enqueue("a"), { type: "start" }]))).toBe(true);
    const done = run([enqueue("a"), { type: "start" }]);
    expect(isBusy(run([succeeded(done.inFlight!.id, 2)], done))).toBe(false);
  });

  it("is busy from the moment a choice is picked, before it is queued", () => {
    const picked = run([{ type: "choose", key: "fit", value: "slim" }]);

    expect(isBusy(picked)).toBe(true);
    expect(isBusy(run([{ type: "seen", version: 2 }], picked))).toBe(false);
  });

  it("ignores an answer for a change that is not the one on its way", () => {
    const state = run([enqueue("a"), { type: "start" }, succeeded(999, 5)]);

    expect(state.inFlight).not.toBeNull();
    expect(state.version).toBe(1);
  });
});

describe("a version conflict", () => {
  const conflicted = () => {
    let state = run([enqueue("a"), enqueue("b"), enqueue("c"), { type: "start" }]);
    state = run([{ type: "choose", key: "a", value: "slim" }, failed(state.inFlight!.id, "Changed elsewhere.", "conflict")], state);
    return state;
  };

  it("drops the rest of the queue and stops, with one message", () => {
    const state = conflicted();

    expect(state.conflict).toBe("Changed elsewhere.");
    expect(state.queue).toEqual([]);
    expect(state.inFlight).toBeNull();
    expect(state.problems).toEqual({});
    expect(canStart(run([enqueue("d")], state))).toBe(false);
  });

  it("refuses new changes until the design has been reloaded", () => {
    const state = run([enqueue("d"), { type: "start" }], conflicted());

    expect(state.queue).toEqual([]);
    expect(state.inFlight).toBeNull();
  });

  it("drops every choice that was shown before the server agreed", () => {
    expect(conflicted().optimistic).toEqual({});
  });

  it("is cleared when the design's version changes, for example after Reload", () => {
    const state = run([{ type: "seen", version: 4 }], conflicted());

    expect(state.conflict).toBeNull();
    expect(state.version).toBe(4);
    expect(run([enqueue("d"), { type: "start" }], state).inFlight).toMatchObject({ key: "d", expectedVersion: 4 });
  });

  it("is not cleared by the same version arriving again", () => {
    expect(run([{ type: "seen", version: 1 }], conflicted()).conflict).toBe("Changed elsewhere.");
  });
});

describe("a reply that never came", () => {
  const lost = () => {
    const state = run([enqueue("a"), enqueue("b"), { type: "start" }]);
    return run([{ type: "lost", id: state.inFlight!.id, message: "We could not reach the server.", detail: "fetch failed" }], state);
  };

  it("refreshes the design before anything else is sent", () => {
    const state = lost();

    expect(state.needsRefresh).toBe(true);
    expect(state.inFlight).toBeNull();
    expect(state.queue.map((change) => change.key)).toEqual(["b"]);
    expect(canStart(state)).toBe(false);
    expect(run([{ type: "start" }], state).inFlight).toBeNull();
  });

  it("keeps the reason and shows the general sentence beside the control", () => {
    expect(lost().problems.a).toEqual({ message: "We could not reach the server.", detail: "fetch failed", focus: false });
  });

  it("carries on, at the version the server holds, once the design has been read", () => {
    const state = run([{ type: "refreshed", version: 2 }, { type: "start" }], lost());

    expect(state.needsRefresh).toBe(false);
    expect(state.inFlight).toMatchObject({ key: "b", expectedVersion: 2 });
  });

  it("carries on at the same version when the lost change was never saved", () => {
    const state = run([{ type: "refreshed", version: 1 }, { type: "start" }], lost());

    expect(state.inFlight).toMatchObject({ key: "b", expectedVersion: 1 });
  });

  it("stops with one message when the design cannot be read either", () => {
    const state = run([{ type: "refreshFailed", message: "Reload the page." }], lost());

    expect(state.conflict).toBe("Reload the page.");
    expect(state.queue).toEqual([]);
    expect(state.needsRefresh).toBe(false);
  });
});

describe("what is known about the version", () => {
  it("never goes down", () => {
    const state = run([{ type: "seen", version: 5 }, { type: "seen", version: 3 }]);

    expect(state.version).toBe(5);
  });

  it("goes up with a save", () => {
    const started = run([enqueue("a"), { type: "start" }]);

    expect(run([succeeded(started.inFlight!.id, 7)], started).version).toBe(7);
  });

  it("does not go down when an answer is older than what is known", () => {
    const started = run([{ type: "seen", version: 9 }, enqueue("a"), { type: "start" }]);

    expect(run([succeeded(started.inFlight!.id, 4)], started).version).toBe(9);
  });

  it("says when nothing changed", () => {
    const started = run([enqueue("a"), { type: "start" }]);

    expect(run([succeeded(started.inFlight!.id, 1)], started).status).toBe("Nothing changed.");
    expect(run([succeeded(started.inFlight!.id, 2)], started).status).toBe("Saved as version 2.");
  });
});

describe("problems belong to their control", () => {
  it("are not cleared by a success somewhere else", () => {
    let state = run([enqueue("a"), enqueue("b"), { type: "start" }]);
    state = run([failed(state.inFlight!.id, "Not that."), { type: "start" }], state);
    state = run([succeeded(state.inFlight!.id, 2)], state);

    expect(state.problems.a).toMatchObject({ message: "Not that." });
  });

  it("are cleared by a success of the same control", () => {
    let state = run([enqueue("a"), { type: "start" }]);
    state = run([failed(state.inFlight!.id, "Not that."), enqueue("a"), { type: "start" }], state);
    state = run([succeeded(state.inFlight!.id, 2)], state);

    expect(state.problems).toEqual({});
  });

  it("can be raised from the browser and cleared", () => {
    let state = run([{ type: "problem", key: "m", message: "Enter a length.", focus: true }]);
    expect(state.problems.m).toEqual({ message: "Enter a length.", focus: true });
    expect(state.focusKey).toBe("m");

    state = run([{ type: "clearProblem", key: "m" }], state);
    expect(state.problems).toEqual({});
  });
});

describe("focus", () => {
  it("moves to a control only when the person asked for the save", () => {
    const asked = run([enqueue("a", option("fit", "slim"), true), { type: "start" }]);
    const askedFailed = run([failed(asked.inFlight!.id)], asked);
    expect(askedFailed.focusKey).toBe("a");

    const late = run([enqueue("a", option("fit", "slim"), false), { type: "start" }]);
    const lateFailed = run([failed(late.inFlight!.id)], late);
    expect(lateFailed.focusKey).toBeNull();
    expect(lateFailed.problems.a.message).toBe("No.");
  });

  it("is used up once the page has acted on it", () => {
    const state = run([{ type: "problem", key: "m", message: "x", focus: true }, { type: "focused" }]);

    expect(state.focusKey).toBeNull();
  });

  it("does not take focus for a problem found on blur", () => {
    const state = run([{ type: "problem", key: "m", message: "x", focus: false }]);

    expect(state.focusKey).toBeNull();
    expect(state.problems.m.message).toBe("x");
  });
});

describe("choices shown before the server agrees", () => {
  it("shows the choice at once", () => {
    const state = run([{ type: "choose", key: "fit", value: "slim" }]);

    expect(shownChoice(state, "fit", "regular")).toBe("slim");
    expect(shownChoice(state, "hem", "straight")).toBe("straight");
  });

  it("shows the server's choice once the change succeeds", () => {
    let state = run([{ type: "choose", key: "fit", value: "slim" }, enqueue("fit"), { type: "start" }]);
    state = run([succeeded(state.inFlight!.id, 2)], state);

    expect(shownChoice(state, "fit", "regular")).toBe("regular");
  });

  it("shows the server's choice again when the change fails", () => {
    let state = run([{ type: "choose", key: "fit", value: "slim" }, enqueue("fit"), { type: "start" }]);
    state = run([failed(state.inFlight!.id)], state);

    expect(shownChoice(state, "fit", "regular")).toBe("regular");
  });

  it("shows the server's choice when the design's version changes", () => {
    const state = run([{ type: "choose", key: "fit", value: "slim" }, { type: "seen", version: 2 }]);

    expect(shownChoice(state, "fit", "relaxed")).toBe("relaxed");
  });

  it("keeps the choice of one control when a different control settles", () => {
    let state = run([
      { type: "choose", key: "fit", value: "slim" },
      { type: "choose", key: "hem", value: "curved" },
      enqueue("hem", option("hem-shape", "curved")),
      { type: "start" },
    ]);
    state = run([succeeded(state.inFlight!.id, 2)], state);

    expect(shownChoice(state, "fit", "regular")).toBe("slim");
    expect(shownChoice(state, "hem", "straight")).toBe("straight");
  });

  it("keeps a newer pick on the same control when the earlier change settles", () => {
    let state = run([
      { type: "choose", key: "fit", value: "slim" },
      enqueue("fit", option("fit", "slim")),
      { type: "start" },
      { type: "choose", key: "fit", value: "relaxed" },
    ]);
    state = run([succeeded(state.inFlight!.id, 2)], state);

    expect(shownChoice(state, "fit", "slim")).toBe("relaxed");
  });

  it("keeps a newer pick on the same control when the earlier change fails", () => {
    let state = run([
      { type: "choose", key: "fit", value: "slim" },
      enqueue("fit", option("fit", "slim")),
      { type: "start" },
      { type: "choose", key: "fit", value: "relaxed" },
    ]);
    state = run([failed(state.inFlight!.id)], state);

    expect(shownChoice(state, "fit", "regular")).toBe("relaxed");
  });

  it("shows the server's choice after a lost reply", () => {
    let state = run([{ type: "choose", key: "fit", value: "slim" }, enqueue("fit"), { type: "start" }]);
    state = run([{ type: "lost", id: state.inFlight!.id, message: "x", detail: "y" }], state);

    expect(shownChoice(state, "fit", "regular")).toBe("regular");
  });
});

describe("what the header says", () => {
  it("keeps the notice of what a change removed until the next one", () => {
    const started = run([enqueue("a"), { type: "start" }]);
    const dropped = [{ kind: "option", id: "x", message: "It went." }] as const;

    const state = run([{ type: "succeeded", id: started.inFlight!.id, version: 2, dropped }], started);

    expect(state.dropped).toEqual(dropped);
  });
});
