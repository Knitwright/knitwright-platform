import { describe, expect, it } from "vitest";
import type { SpecAction } from "@/lib/garment";
import { type IntentOutcome } from "./outcome";
import { encodeEvent, followUpsForBrowser, parseEvent, questionForBrowser, splitLines, type StreamEvent } from "./stream";

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

describe("ways on for the browser", () => {
  it("signs the changes of each way on with its label, and passes words to send or finish as they are", () => {
    const signed: string[] = [];
    const shown = followUpsForBrowser(
      [
        {
          text: "How much longer?",
          choices: [
            { kind: "say", label: "+1 cm", text: "Make the sleeve length 1 cm longer" },
            { kind: "fill", label: "Type the sleeve length", text: "Set the sleeve length to " },
            { kind: "apply", label: "Long sleeve", actions: [slim] },
          ],
        },
      ],
      (actions, label) => {
        signed.push(label);
        return `token-${actions.length}`;
      },
    );
    expect(shown).toEqual({
      followUps: [
        {
          text: "How much longer?",
          choices: [
            { kind: "say", label: "+1 cm", text: "Make the sleeve length 1 cm longer" },
            { kind: "fill", label: "Type the sleeve length", text: "Set the sleeve length to " },
            { kind: "apply", label: "Long sleeve", token: "token-1" },
          ],
        },
      ],
    });
    expect(signed).toEqual(["Long sleeve"]);
  });

  it("adds nothing when there are no ways on", () => {
    expect(followUpsForBrowser(undefined, () => "x")).toEqual({});
    expect(followUpsForBrowser([], () => "x")).toEqual({});
  });

  it("reads an outcome with ways on, and one without", () => {
    const line = encodeEvent({ type: "outcome", outcome: { kind: "rejection", reason: "No.", followUps: [{ text: "Try this.", choices: [{ kind: "say", label: "+1 cm", text: "Make it 1 cm longer" }] }] } });
    expect(parseEvent(line.trim())).toMatchObject({ outcome: { followUps: [{ text: "Try this." }] } });
    expect(parseEvent(encodeEvent({ type: "outcome", outcome: { kind: "rejection", reason: "No." } }).trim())).toEqual({ type: "outcome", outcome: { kind: "rejection", reason: "No." } });
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
