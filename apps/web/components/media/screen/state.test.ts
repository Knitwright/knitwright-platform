import { describe, expect, it } from "vitest";
import { SAME_VERSION_MESSAGE, TIMEOUT_MESSAGE, UNLOCKED_LABEL } from "./copy";
import { item, lifestyle, setOf, studio, unlocked } from "./fixtures";
import { INITIAL, POLL_LIMIT, canMake, canUnlock, reduce, shouldPoll, type State } from "./state";

const run = (actions: Parameters<typeof reduce>[1][], from: State = INITIAL): State => actions.reduce(reduce, from);

describe("loading", () => {
  it("starts loading, then shows an empty screen when there is no set", () => {
    expect(INITIAL.phase).toBe("loading");
    expect(run([{ type: "loaded", set: null }]).phase).toBe("empty");
  });

  it("opens a finished set as ready and a running one as working", () => {
    expect(run([{ type: "loaded", set: setOf() }]).phase).toBe("ready");
    expect(run([{ type: "loaded", set: setOf({ status: "running", items: [] }) }]).phase).toBe("working");
    expect(run([{ type: "loaded", set: setOf({ status: "failed", error: "No.", items: [] }) }]).phase).toBe("failed");
  });

  it("shows a problem reading the set and lets the person ask again", () => {
    const state = run([{ type: "problem", message: "Sign in again." }]);
    expect(state.phase).toBe("empty");
    expect(state.message).toEqual({ tone: "warn", text: "Sign in again." });
  });
});

describe("making a set", () => {
  it("is busy while the request is out, then works until the set is finished", () => {
    let state = run([{ type: "loaded", set: null }, { type: "make" }]);
    expect(state).toMatchObject({ busy: "start", phase: "empty" });
    state = reduce(state, { type: "made", created: true, set: setOf({ status: "queued", items: [] }) });
    expect(state).toMatchObject({ busy: null, phase: "working", message: null });
    expect(shouldPoll(state)).toBe(true);
    state = reduce(state, { type: "polled", set: setOf() });
    expect(state.phase).toBe("ready");
    expect(shouldPoll(state)).toBe(false);
  });

  it("says plainly when the set for this version already existed", () => {
    const state = run([{ type: "loaded", set: setOf() }, { type: "make" }, { type: "made", created: false, set: setOf() }]);
    expect(state.message).toEqual({ tone: "info", text: SAME_VERSION_MESSAGE });
    expect(state.phase).toBe("ready");
  });

  it("does not claim the version existed when it was running", () => {
    const state = run([{ type: "make" }, { type: "made", created: false, set: setOf({ status: "running", items: [] }) }]);
    expect(state.message).toBeNull();
    expect(state.phase).toBe("working");
  });

  it("keeps the pictures it has when a request fails", () => {
    const state = run([{ type: "loaded", set: setOf() }, { type: "make" }, { type: "problem", message: "Slow down." }]);
    expect(state).toMatchObject({ busy: null, phase: "ready", message: { tone: "warn", text: "Slow down." } });
    expect(state.set?.items).toHaveLength(3);
  });

  it("stops polling after the limit with an honest sentence", () => {
    let state = run([{ type: "made", created: true, set: setOf({ status: "running", items: [] }) }]);
    for (let i = 0; i < POLL_LIMIT; i++) state = reduce(state, { type: "polled", set: setOf({ status: "running", items: [] }) });
    expect(state.message).toEqual({ tone: "warn", text: TIMEOUT_MESSAGE });
    expect(shouldPoll(state)).toBe(false);
  });

  it("ignores a poll that fails once and carries on", () => {
    const state = run([{ type: "made", created: true, set: setOf({ status: "running", items: [] }) }, { type: "pollFailed" }]);
    expect(state.polls).toBe(1);
    expect(shouldPoll(state)).toBe(true);
  });
});

describe("using credits", () => {
  it("is allowed only on a finished, locked set", () => {
    expect(canUnlock(INITIAL)).toBe(false);
    expect(canUnlock(run([{ type: "loaded", set: setOf({ status: "running", items: [] }) }]))).toBe(false);
    expect(canUnlock(run([{ type: "loaded", set: setOf() }]))).toBe(true);
    expect(canUnlock(run([{ type: "loaded", set: unlocked(setOf()) }]))).toBe(false);
    expect(canUnlock(run([{ type: "loaded", set: setOf({ status: "failed", items: [] }) }]))).toBe(false);
  });

  it("is busy while the credits go, then shows the clean set", () => {
    let state = run([{ type: "loaded", set: setOf() }, { type: "unlock" }]);
    expect(state.busy).toBe("unlock");
    expect(canUnlock(state)).toBe(false);
    state = reduce(state, { type: "unlocked", set: unlocked(setOf()) });
    expect(state).toMatchObject({ busy: null, message: { tone: "ok", text: UNLOCKED_LABEL } });
    expect(state.set?.unlocked).toBe(true);
  });

  it("shows a refusal and leaves the set locked", () => {
    const state = run([{ type: "loaded", set: setOf() }, { type: "unlock" }, { type: "problem", message: "Marketing media costs 5 credits. Your balance is 2." }]);
    expect(state.set?.unlocked).toBe(false);
    expect(state.message?.text).toMatch(/costs 5 credits/);
  });
});

describe("the clip", () => {
  const withStill = setOf({ items: [...studio(), ...lifestyle(["scene"])] });

  it("polls until the clip appears in the set", () => {
    let state = run([{ type: "loaded", set: withStill }, { type: "clip" }, { type: "clipStarted", state: "started" }]);
    expect(state).toMatchObject({ busy: null, awaiting: "clip" });
    expect(shouldPoll(state)).toBe(true);
    state = reduce(state, { type: "polled", set: setOf({ items: [...withStill.items, item({ kind: "clip", view: "scene" })] }) });
    expect(state.awaiting).toBeNull();
    expect(shouldPoll(state)).toBe(false);
  });

  it("does not wait for a clip that already exists", () => {
    const state = run([{ type: "loaded", set: withStill }, { type: "clip" }, { type: "clipStarted", state: "exists" }]);
    expect(state.awaiting).toBeNull();
  });
});

describe("a recording", () => {
  it("is busy while it records, and the saved turntable arrives by reading the set again", () => {
    let state = run([{ type: "loaded", set: setOf() }, { type: "turntable" }]);
    expect(state.busy).toBe("turntable");
    expect(canMake(state)).toBe(false);
    state = reduce(state, { type: "turntableDone", message: "Saved.", tone: "ok", set: setOf({ items: [...studio(), item({ kind: "turntable", view: "three_quarter" })] }) });
    expect(state.busy).toBeNull();
    expect(state.set?.items.some((entry) => entry.kind === "turntable")).toBe(true);
    expect(state.message).toEqual({ tone: "ok", text: "Saved." });
  });

  it("keeps the set when the recording fails", () => {
    const state = run([{ type: "loaded", set: setOf() }, { type: "turntable" }, { type: "turntableDone", message: "No.", tone: "warn", set: null }]);
    expect(state.set?.items).toHaveLength(3);
    expect(state.message).toEqual({ tone: "warn", text: "No." });
  });
});

describe("canMake", () => {
  it("allows making the first set, and again after a failure, but not while working", () => {
    expect(canMake(run([{ type: "loaded", set: null }]))).toBe(true);
    expect(canMake(run([{ type: "loaded", set: setOf({ status: "failed", items: [] }) }]))).toBe(true);
    expect(canMake(run([{ type: "loaded", set: setOf({ status: "running", items: [] }) }]))).toBe(false);
    expect(canMake(run([{ type: "loaded", set: setOf() }]))).toBe(true);
    expect(canMake(INITIAL)).toBe(false);
    const gaveUp = run([{ type: "made", created: true, set: setOf({ status: "running", items: [] }) }, ...Array.from({ length: POLL_LIMIT }, () => ({ type: "pollFailed" }) as const)]);
    expect(canMake(gaveUp)).toBe(true);
  });
});
