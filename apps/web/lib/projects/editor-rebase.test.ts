import { describe, expect, it } from "vitest";
import { start as startSpec } from "@/lib/garment/fixtures/specs";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { workingSpec } from "./effective-spec";
import {
  canStart,
  editorReducer,
  initialEditorState,
  isBusy,
  type EditorEvent,
  type EditorState,
  type Request,
} from "./editor-state";

/**
 * Quick edits made one after another must each land on top of the last one the server
 * saved. These tests play out what the usability audit saw: colours that did not stick, an
 * option that was gone one version later, and a conflict about the person's own edits.
 */

const spec = startSpec("crew-tee");

const run = (events: readonly EditorEvent[], from: EditorState = initialEditorState(1)): EditorState =>
  events.reduce(editorReducer, from);

const colour = (panelId: string, swatch: string): Request => ({ kind: "colour", panelId, change: { swatch } });
const enqueue = (key: string, request: Request): EditorEvent => ({ type: "enqueue", key, request, focus: false });
/** The page still holds the design it was given: version 1, `spec`. */
const begin = (page: GarmentSpec = spec): EditorEvent => ({ type: "start", spec: page });
const succeeded = (state: EditorState, version: number): EditorEvent => ({
  type: "succeeded",
  id: state.inFlight!.id,
  version,
  dropped: [],
});

const swatches = (action: SpecAction | undefined) =>
  action?.type === "update-colourway" ? action.colourway.colours.map((entry) => [entry.panelId, entry.swatch]) : [];
const sentAction = (state: EditorState) => (state.inFlight?.request.kind === "action" ? state.inFlight.request.action : undefined);

describe("a change made after an earlier one was saved, before the page shows it", () => {
  it("keeps the earlier colour: the next colour is worked out on top of it", () => {
    let state = run([enqueue("colour:body-front", colour("body-front", "#111111")), begin()]);
    state = run([succeeded(state, 2)], state);
    // "Saving" has cleared, but the page has not yet been sent version 2.
    expect(isBusy(state)).toBe(false);

    state = run([enqueue("colour:body-back", colour("body-back", "#222222")), begin()], state);

    expect(state.inFlight?.expectedVersion).toBe(2);
    expect(swatches(sentAction(state))).toEqual([
      ["body-front", "#111111"],
      ["body-back", "#222222"],
    ]);
  });

  it("shows both colours in the design being worked on", () => {
    let state = run([enqueue("colour:body-front", colour("body-front", "#111111")), begin()]);
    state = run([succeeded(state, 2), enqueue("colour:body-back", colour("body-back", "#222222"))], state);

    const working = workingSpec(spec, 1, state);

    expect(working.colourways[0].colours.map((entry) => entry.swatch)).toEqual(["#111111", "#222222"]);
  });

  it("forgets a saved change once the page shows its version", () => {
    let state = run([enqueue("colour:body-front", colour("body-front", "#111111")), begin()]);
    state = run([succeeded(state, 2)], state);
    expect(state.saved).toHaveLength(1);

    state = run([{ type: "seen", version: 2 }], state);

    expect(state.saved).toEqual([]);
    expect(state.shown).toBe(2);
  });

  it("works out a waiting colour when it is sent, not when it was picked", () => {
    // Both are picked while nothing has been sent. The second is worked out after the first is saved.
    let state = run([
      enqueue("colour:body-front", colour("body-front", "#111111")),
      enqueue("colour:body-back", colour("body-back", "#222222")),
      begin(),
    ]);
    state = run([succeeded(state, 2), begin()], state);

    expect(swatches(sentAction(state))).toEqual([
      ["body-front", "#111111"],
      ["body-back", "#222222"],
    ]);
  });

  it("joins two waiting changes to the colour of one part, so neither is lost", () => {
    const state = run([
      enqueue("colour:body-front", { kind: "colour", panelId: "body-front", change: { colourText: "Navy 19-4024" } }),
      enqueue("colour:body-front", colour("body-front", "#111111")),
      begin(),
    ]);

    const sent = sentAction(state);
    expect(sent?.type === "update-colourway" && sent.colourway.colours[0]).toMatchObject({
      panelId: "body-front",
      colour: "Navy 19-4024",
      swatch: "#111111",
    });
  });

  it("keeps a colour that the rules refuse as a problem of its own part, and sends the rest", () => {
    const state = run([
      enqueue("colour:nothing", colour("no-such-part", "#111111")),
      enqueue("colour:body-back", colour("body-back", "#222222")),
      begin(),
      begin(),
    ]);

    expect(state.problems["colour:nothing"]?.message).toBe("This design has no such part to colour.");
    expect(swatches(sentAction(state))).toEqual([["body-back", "#222222"]]);
  });

  it("waits for the page after an undo, which cannot be worked out here", () => {
    let state = run([enqueue("history", { kind: "undo" }), begin()]);
    state = run([succeeded(state, 2), enqueue("colour:body-back", colour("body-back", "#222222"))], state);

    expect(canStart(state)).toBe(false);
    expect(run([begin()], state).inFlight).toBeNull();

    state = run([{ type: "seen", version: 2 }, begin()], state);
    expect(state.inFlight?.expectedVersion).toBe(2);
  });
});

describe("a conflict about the person's own save", () => {
  const conflicted = () => {
    let state = run([
      enqueue("option:neckline", {
        kind: "action",
        action: { type: "set-option", optionId: "neckline", choiceId: "v-neck", provenance: "user-edited" },
      }),
      enqueue("option:sleeve", {
        kind: "action",
        action: { type: "set-option", optionId: "sleeve", choiceId: "raglan", provenance: "user-edited" },
      }),
      begin(),
    ]);
    state = run([{ type: "failed", id: state.inFlight!.id, code: "conflict", message: "This design was changed somewhere else." }], state);
    return state;
  };

  it("is checked before anything is dropped", () => {
    const state = conflicted();

    expect(state.conflict).toBeNull();
    expect(state.check).toMatchObject({ reason: "conflict", since: 1 });
    expect(state.queue.map((change) => change.key)).toEqual(["option:sleeve"]);
    expect(isBusy(state)).toBe(true);
    expect(canStart(state)).toBe(false);
  });

  it("is not a conflict when every newer version is the person's own: both changes are sent again, on top", () => {
    let state = run([{ type: "verified", version: 2, others: 0 }], conflicted());

    expect(state.conflict).toBeNull();
    expect(state.queue.map((change) => change.key)).toEqual(["option:neckline", "option:sleeve"]);
    // The page must show version 2 first, so that nothing is worked out from an older design.
    expect(canStart(state)).toBe(false);

    state = run([{ type: "seen", version: 2 }, begin()], state);
    expect(state.inFlight).toMatchObject({ key: "option:neckline", expectedVersion: 2 });
  });

  it("sends the change again under a new number, so that it is sent at all", () => {
    const before = conflicted();
    const lostId = before.check!.change.id;
    const state = run([{ type: "verified", version: 2, others: 0 }, { type: "seen", version: 2 }, begin()], before);

    expect(state.inFlight?.id).not.toBe(lostId);
  });

  it("stops with the message when someone else saved in between", () => {
    const state = run([{ type: "verified", version: 2, others: 1 }], conflicted());

    expect(state.conflict).toBe("This design was changed somewhere else.");
    expect(state.queue).toEqual([]);
    expect(state.check).toBeNull();
  });

  it("stops after trying again once, so it can never go round for ever", () => {
    let state = run([{ type: "verified", version: 2, others: 0 }, { type: "seen", version: 2 }, begin()], conflicted());
    state = run([{ type: "failed", id: state.inFlight!.id, code: "conflict", message: "Changed." }], state);

    expect(state.check).toBeNull();
    expect(state.conflict).toBe("Changed.");
  });

  it("stops with one message when the design cannot be read", () => {
    const state = run([{ type: "verifyFailed", message: "Reload the page." }], conflicted());

    expect(state.conflict).toBe("Reload the page.");
    expect(state.check).toBeNull();
    expect(isBusy(state)).toBe(false);
  });
});

describe("a save that failed", () => {
  const failedOn = (code: string) => {
    const state = run([enqueue("colour:body-front", colour("body-front", "#111111")), begin()]);
    return run([{ type: "failed", id: state.inFlight!.id, code, message: "Something went wrong on our side. Try again." }], state);
  };

  it("is offered again with Retry when the failure was on our side, and is no longer saving", () => {
    const state = failedOn("internal");

    expect(isBusy(state)).toBe(false);
    expect(state.retry).toMatchObject({ message: "Something went wrong on our side. Try again." });
    expect(state.retry?.change.key).toBe("colour:body-front");
  });

  it("is sent again when Retry is pressed", () => {
    const state = run([{ type: "retry" }, begin()], failedOn("unavailable"));

    expect(state.retry).toBeNull();
    expect(state.inFlight?.key).toBe("colour:body-front");
  });

  it("is not sent again when a newer change to the same control is already waiting", () => {
    let state = failedOn("rate_limited");
    state = run([enqueue("colour:body-front", colour("body-front", "#333333")), { type: "retry" }], state);

    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].request).toEqual(colour("body-front", "#333333"));
  });

  it("is offered again after a lost reply when the server did not save it", () => {
    let state = run([enqueue("colour:body-front", colour("body-front", "#111111")), begin()]);
    state = run([{ type: "lost", id: state.inFlight!.id, message: "We could not reach the server.", detail: "timeout" }], state);
    state = run([{ type: "verified", version: 1, others: 0 }], state);

    expect(state.retry?.message).toBe("We could not reach the server.");
    expect(isBusy(state)).toBe(false);
  });

  it("is taken as saved after a lost reply when the design moved on, and the page is waited for", () => {
    let state = run([enqueue("colour:body-front", colour("body-front", "#111111")), begin()]);
    state = run([{ type: "lost", id: state.inFlight!.id, message: "x", detail: "y" }], state);
    state = run([{ type: "verified", version: 2, others: 0 }, enqueue("a", colour("body-back", "#222222"))], state);

    expect(state.retry).toBeNull();
    expect(state.version).toBe(2);
    expect(canStart(state)).toBe(false);
    expect(canStart(run([{ type: "seen", version: 2 }], state))).toBe(true);
  });
});

describe("a choice picked while the design is in conflict", () => {
  it("is not shown as saving for ever", () => {
    const conflicted = run([{ type: "verifyFailed", message: "Reload." }], run([enqueue("a", colour("body-front", "#111111")), begin(), { type: "lost", id: 1, message: "x", detail: "y" }]));

    const state = run([{ type: "choose", key: "option:fit", value: "slim" }], conflicted);

    expect(state.optimistic).toEqual({});
    expect(isBusy(state)).toBe(false);
  });
});
