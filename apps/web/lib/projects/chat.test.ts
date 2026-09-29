import { describe, expect, it } from "vitest";
import { encodeEvent } from "@/lib/intent/stream";
import { chatReducer, initialChat, pendingText, readEvents, refusalMessage, type ChatState } from "./chat";

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
