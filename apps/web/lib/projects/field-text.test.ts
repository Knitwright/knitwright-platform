import { describe, expect, it } from "vitest";
import { fieldReduce, hasUnsavedWork, initialField, intentFromText, isDirty, sameCm } from "./field-text";

const own = { valueCm: "52.5", valueTenths: 5250, isOwn: true };
const chart = { valueCm: "50", valueTenths: 5000, isOwn: false };
const empty = { valueCm: "", valueTenths: null, isOwn: false };

describe("sameCm", () => {
  it("compares lengths, not text", () => {
    expect(sameCm("52,5", "52.5")).toBe(true);
    expect(sameCm(" 52.5 ", "52.50")).toBe(true);
    expect(sameCm("52.5", "52.6")).toBe(false);
    expect(sameCm("", "  ")).toBe(true);
    expect(sameCm("", "52.5")).toBe(false);
  });

  it("compares text that is not a length as text", () => {
    expect(sameCm("abc", " abc ")).toBe(true);
    expect(sameCm("abc", "abd")).toBe(false);
    expect(sameCm("abc", "")).toBe(false);
  });
});

describe("intentFromText", () => {
  it.each(["52,5", " 52.5 ", "52.50", "52.5"])("does nothing when %j is the value already held", (text) => {
    expect(intentFromText(text, own)).toEqual({ kind: "none" });
  });

  it("sets a different value, exactly", () => {
    expect(intentFromText("53,25", own)).toEqual({ kind: "set", tenths: 5325 });
    expect(intentFromText("40", empty)).toEqual({ kind: "set", tenths: 4000 });
  });

  it("clears a value the person typed when the field is emptied", () => {
    expect(intentFromText("", own)).toEqual({ kind: "remove" });
    expect(intentFromText("   ", own)).toEqual({ kind: "remove" });
  });

  it("does nothing when the field is empty and there is no value of the person's own", () => {
    expect(intentFromText("", empty)).toEqual({ kind: "none" });
    expect(intentFromText("", chart)).toEqual({ kind: "none" });
  });

  it("does nothing when a value from a chart is left as it is", () => {
    expect(intentFromText("50", chart)).toEqual({ kind: "none" });
  });

  it("asks for a length when the text is not one", () => {
    expect(intentFromText("wide", own)).toEqual({ kind: "invalid", reason: "Enter a length in centimetres, such as 52.5." });
    expect(intentFromText("999", own)).toMatchObject({ kind: "invalid" });
  });
});

describe("isDirty", () => {
  it("is false when the text means the same as the value", () => {
    expect(isDirty("52.50", "52.5")).toBe(false);
    expect(isDirty("", "")).toBe(false);
  });

  it("is true when the text differs, is not a length, or was emptied", () => {
    expect(isDirty("53", "52.5")).toBe(true);
    expect(isDirty("abc", "")).toBe(true);
    expect(isDirty("", "52.5")).toBe(true);
  });
});

describe("hasUnsavedWork", () => {
  it("is true while a change is pending or any field holds text that was not saved", () => {
    expect(hasUnsavedWork(true, [])).toBe(true);
    expect(hasUnsavedWork(false, [false, true])).toBe(true);
    expect(hasUnsavedWork(false, [false, false])).toBe(false);
    expect(hasUnsavedWork(false, [])).toBe(false);
  });
});

describe("fieldReduce", () => {
  it("starts with the value the server holds", () => {
    expect(initialField("52.5")).toEqual({ text: "52.5", server: "52.5", touched: false, sent: null, changedElsewhere: false });
  });

  it("follows the server while the person has not typed", () => {
    const state = fieldReduce(initialField("52.5"), { type: "server", valueCm: "53" });

    expect(state).toMatchObject({ text: "53", server: "53", changedElsewhere: false });
  });

  it("keeps what the person is typing when the design changed for another reason, and says so", () => {
    let state = fieldReduce(initialField("52.5"), { type: "type", text: "55" });
    state = fieldReduce(state, { type: "server", valueCm: "60" });

    expect(state).toMatchObject({ text: "55", server: "60", changedElsewhere: true, touched: true });
  });

  it("shows the value as the server holds it after a save", () => {
    let state = fieldReduce(initialField(""), { type: "type", text: "52,5" });
    state = fieldReduce(state, { type: "sent" });
    state = fieldReduce(state, { type: "server", valueCm: "52.5" });

    expect(state).toMatchObject({ text: "52.5", server: "52.5", touched: false, sent: null, changedElsewhere: false });
  });

  it("does not overwrite text typed after the save was sent, and does not blame another change", () => {
    let state = fieldReduce(initialField(""), { type: "type", text: "52.5" });
    state = fieldReduce(state, { type: "sent" });
    state = fieldReduce(state, { type: "type", text: "52.55" });
    state = fieldReduce(state, { type: "server", valueCm: "52.5" });

    expect(state).toMatchObject({ text: "52.55", server: "52.5", changedElsewhere: false, touched: true });
  });

  it("shows an emptied value as empty after a save", () => {
    let state = fieldReduce(initialField("52.5"), { type: "type", text: "" });
    state = fieldReduce(state, { type: "sent" });
    state = fieldReduce(state, { type: "server", valueCm: "" });

    expect(state).toMatchObject({ text: "", touched: false });
  });

  it("shows the chart's value after the person's own value was cleared", () => {
    let state = fieldReduce(initialField("52.5"), { type: "type", text: "" });
    state = fieldReduce(state, { type: "sent" });
    state = fieldReduce(state, { type: "server", valueCm: "50" });

    expect(state).toMatchObject({ text: "50", server: "50", changedElsewhere: false });
  });

  it("does nothing when the server value is the one it already has", () => {
    const before = fieldReduce(initialField("52.5"), { type: "type", text: "55" });

    expect(fieldReduce(before, { type: "server", valueCm: "52.5" })).toEqual(before);
  });

  it("stops warning once the text matches the server again", () => {
    let state = fieldReduce(initialField("52.5"), { type: "type", text: "55" });
    state = fieldReduce(state, { type: "server", valueCm: "60" });
    state = fieldReduce(state, { type: "type", text: "60" });

    expect(state.changedElsewhere).toBe(false);
  });
});
