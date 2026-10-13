import { describe, expect, it } from "vitest";
import { encodeEvent } from "@/lib/intent/stream";
import { chatFromHistory, chatReducer, initialChat, pendingText, readEvents, refusalMessage, type ChatState } from "./chat";

const play = (...events: Parameters<typeof chatReducer>[1][]): ChatState => events.reduce(chatReducer, initialChat);

describe("the chat panel", () => {
  it("shows the message, then progress, then what changed", () => {
    const sending = play({ type: "sent", text: "make it roomier" });
    expect(sending.messages).toEqual([{ id: 1, from: "person", kind: "text", text: "make it roomier", lines: [], choices: [], answered: null }]);
    expect(sending.pending).toBe("sending");
    const thinking = chatReducer(sending, { type: "stage", stage: "retry" });
    expect(pendingText(thinking.pending)).toMatch(/stronger model/);
    const done = chatReducer(thinking, { type: "outcome", outcome: { kind: "applied", explanations: ["Fit changed."], notes: ["Cuffs removed."], version: 3 } });
    expect(done.pending).toBeNull();
    expect(done.messages[1]).toMatchObject({ from: "assistant", kind: "applied", text: "Done. The design is saved as a new version.", lines: ["Fit changed.", "Cuffs removed."] });
  });

  it("shows a question as choices, marking the recommended one, and records the answer once", () => {
    const asked = play(
      { type: "sent", text: "change the type" },
      { type: "outcome", outcome: { kind: "question", question: "Which?", choices: [{ label: "Polo", token: "t1" }, { label: "Keep it", token: null }], recommended: 1 } },
    );
    expect(asked.messages[1]).toMatchObject({
      kind: "question",
      text: "Which?",
      choices: [
        { label: "Polo", token: "t1", recommended: false },
        { label: "Keep it", token: null, recommended: true },
      ],
      answered: null,
    });
    const chosen = chatReducer(asked, { type: "chose", id: 2, index: 0 });
    expect(chosen.messages[2]).toMatchObject({ from: "person", text: "Polo" });
    expect(chosen.messages[1].answered).toBe(0);
    expect(chatReducer(chosen, { type: "chose", id: 2, index: 1 })).toBe(chosen);
    expect(chatReducer(chosen, { type: "chose", id: 99, index: 0 })).toBe(chosen);
  });

  it("shows a reason, or a failure, plainly", () => {
    const refused = play({ type: "sent", text: "x" }, { type: "outcome", outcome: { kind: "rejection", reason: "No hood." } });
    expect(refused.messages[1]).toMatchObject({ kind: "rejection", text: "No hood." });
    const failed = chatReducer(refused, { type: "failed", message: "Try again." });
    expect(failed.messages[2]).toMatchObject({ kind: "failed", text: "Try again." });
    expect(failed.pending).toBeNull();
    const applied = chatReducer(failed, { type: "choiceApplied", text: "Polo" });
    expect(applied.messages[3]).toMatchObject({ kind: "applied", text: "Done. The design is saved as a new version.", lines: ["Polo"] });
  });

  it("shows each part of a request that was not made under what was, with its ways on", () => {
    const followUps = [
      { text: "A Polo shirt does not come with V neck for Neckline.", choices: [{ kind: "apply" as const, label: "Change to Team jersey (no placket)", token: "t1" }] },
      {
        text: "How much longer should the sleeve length be?",
        choices: [
          { kind: "say" as const, label: "+1 cm", text: "Make the sleeve length 1 cm longer" },
          { kind: "fill" as const, label: "Type the sleeve length", text: "Set the sleeve length to " },
        ],
      },
    ];
    const done = play({ type: "sent", text: "x" }, { type: "outcome", outcome: { kind: "applied", explanations: ["Fit changed."], notes: [], version: 3, followUps } });
    expect(done.messages.map((message) => message.kind)).toEqual(["text", "applied", "question", "question"]);
    expect(done.messages[2]).toMatchObject({
      text: "A Polo shirt does not come with V neck for Neckline.",
      choices: [{ label: "Change to Team jersey (no placket)", token: "t1", words: null, recommended: false }],
    });
    expect(done.messages[3].choices.map((choice) => choice.words)).toEqual([
      { kind: "say", text: "Make the sleeve length 1 cm longer" },
      { kind: "fill", text: "Set the sleeve length to " },
    ]);
  });

  it("puts the ways on of a single reason under the reason itself", () => {
    const followUps = [{ text: "The sleeve length has no value yet.", choices: [{ kind: "fill" as const, label: "Type the sleeve length", text: "Set the sleeve length to " }] }];
    const refused = play({ type: "sent", text: "x" }, { type: "outcome", outcome: { kind: "rejection", reason: "The sleeve length has no value yet. Nothing was changed.", followUps } });
    expect(refused.messages).toHaveLength(2);
    expect(refused.messages[1]).toMatchObject({ kind: "rejection", choices: [{ label: "Type the sleeve length" }] });
    const many = play({ type: "sent", text: "x" }, { type: "outcome", outcome: { kind: "rejection", reason: "None of that could be made.", followUps: [...followUps, ...followUps] } });
    expect(many.messages.map((message) => message.kind)).toEqual(["text", "rejection", "question", "question"]);
  });

  it("marks words that are sent as answered without saying them twice", () => {
    const asked = play(
      { type: "sent", text: "x" },
      { type: "outcome", outcome: { kind: "rejection", reason: "How much?", followUps: [{ text: "How much?", choices: [{ kind: "say", label: "+2 cm", text: "Make the sleeve length 2 cm longer" }] }] } },
    );
    const chosen = chatReducer(asked, { type: "chose", id: 2, index: 0 });
    expect(chosen.messages).toHaveLength(2);
    expect(chosen.messages[1].answered).toBe(0);
    expect(chosen.pending).toBeNull();
  });

  it("starts from the conversation kept for the design", () => {
    const state = chatFromHistory([
      { role: "person", kind: "text", body: "slim fit", lines: [] },
      { role: "assistant", kind: "applied", body: "Done.", lines: ["Fit changed."] },
    ]);
    expect(state.pending).toBeNull();
    expect(state.messages).toEqual([
      { id: 1, from: "person", kind: "text", text: "slim fit", lines: [], choices: [], answered: null },
      { id: 2, from: "assistant", kind: "applied", text: "Done.", lines: ["Fit changed."], choices: [], answered: null },
    ]);
    const next = chatReducer(state, { type: "sent", text: "long sleeves" });
    expect(next.messages[2]).toMatchObject({ id: 3, text: "long sleeves" });
  });

  it("has a sentence for every stage", () => {
    expect(pendingText(null)).toBeNull();
    expect(pendingText("sending")).toMatch(/Reading/);
    expect(pendingText("model")).toMatch(/assistant/);
  });
});

function streamOf(...pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
}

describe("reading the stream", () => {
  it("hands over each whole event, across pieces, skipping lines it cannot read", async () => {
    const line = encodeEvent({ type: "stage", stage: "model" });
    const seen: unknown[] = [];
    const ended = await readEvents(streamOf(line.slice(0, 5), line.slice(5), "junk\n", encodeEvent({ type: "failed", message: "x" })), (event) => seen.push(event));
    expect(seen).toEqual([{ type: "stage", stage: "model" }, { type: "failed", message: "x" }]);
    expect(ended).toBe(true);
  });

  it("says when the stream ended without an outcome", async () => {
    expect(await readEvents(streamOf(encodeEvent({ type: "stage", stage: "model" })), () => undefined)).toBe(false);
  });

  it("reads the message of a refused request", async () => {
    const refused = Response.json({ success: false, error: { code: "over_allowance", message: "Used up." } }, { status: 429 });
    expect(await refusalMessage(refused)).toBe("Used up.");
    expect(await refusalMessage(new Response("gateway", { status: 502 }))).toMatch(/could not answer/);
  });
});
