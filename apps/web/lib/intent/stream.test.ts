import { describe, expect, it } from "vitest";
import type { SpecAction } from "@/lib/garment";
import { type IntentOutcome } from "./outcome";
import { encodeEvent, parseEvent, questionForBrowser, splitLines, type StreamEvent } from "./stream";

const slim: SpecAction = { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" };

describe("the stream of a text request", () => {
  it("writes one JSON line per event and reads it back", () => {
    const events: StreamEvent[] = [
      { type: "stage", stage: "model" },
      { type: "outcome", outcome: { kind: "applied", explanations: ["Fit changed."], notes: [], version: 3 } },
      { type: "outcome", outcome: { kind: "question", question: "Which?", choices: [{ label: "A", token: "t" }, { label: "Keep", token: null }], recommended: 0 } },
      { type: "outcome", outcome: { kind: "rejection", reason: "No." } },
      { type: "failed", message: "Try again." },
    ];
    for (const event of events) {
      const line = encodeEvent(event);
      expect(line.endsWith("\n")).toBe(true);
      expect(parseEvent(line.trim())).toEqual(event);
    }
  });

  it("reads nothing it does not know, rather than guessing", () => {
    for (const junk of ["", "{", "[]", '{"type":"stage","stage":"dance"}', '{"type":"outcome","outcome":{"kind":"applied"}}']) {
      expect(parseEvent(junk)).toBeNull();
    }
  });

  it("splits a stream into whole lines, keeping a part line for the next piece", () => {
    const first = splitLines("", '{"a":1}\n{"b"');
    expect(first).toEqual({ lines: ['{"a":1}'], rest: '{"b"' });
    expect(splitLines(first.rest, ':2}\n\n')).toEqual({ lines: ['{"b":2}'], rest: "" });
  });
});

describe("a question for the browser", () => {
  it("gives each choice that changes something a signed token, and none to a choice that changes nothing", () => {
    const outcome: Extract<IntentOutcome, { kind: "question" }> = {
      kind: "question",
      question: "Change the type?",
      choices: [
        { label: "Change to Polo", actions: [slim] },
        { label: "Keep it", actions: [] },
      ],
      recommended: 0,
    };
    const signed: (readonly SpecAction[])[] = [];
    const shown = questionForBrowser(outcome, (actions) => {
      signed.push(actions);
      return `token-${signed.length}`;
    });
    expect(shown).toEqual({
      kind: "question",
      question: "Change the type?",
      choices: [
        { label: "Change to Polo", token: "token-1" },
        { label: "Keep it", token: null },
      ],
      recommended: 0,
    });
    expect(signed).toEqual([[slim]]);
  });
});
