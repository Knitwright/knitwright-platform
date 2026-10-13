import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SAVED_TEXT } from "./chat";
import { HISTORY_LIMIT, choiceLines, conversationFor, exchangeLines, loadChatHistory, recordLines } from "./chat-history";

describe("the lines kept for one message", () => {
  it("keeps the words, then what changed", () => {
    const lines = exchangeLines("slim fit", { type: "outcome", outcome: { kind: "applied", explanations: ["Fit changed."], notes: ["Cuffs removed."], version: 3 } });
    expect(lines).toEqual([
      { role: "person", kind: "text", body: "slim fit", lines: [] },
      { role: "assistant", kind: "applied", body: SAVED_TEXT, lines: ["Fit changed.", "Cuffs removed."] },
    ]);
  });

  it("keeps each part not made, and what was offered, but never a signed proposal", () => {
    const lines = exchangeLines("long sleeves and a V neck", {
      type: "outcome",
      outcome: {
        kind: "applied",
        explanations: ["Sleeve length changed."],
        notes: [],
        version: 4,
        followUps: [{ text: "A Polo shirt does not come with V neck.", choices: [{ kind: "apply", label: "Change to Team jersey", token: "secret-token" }] }],
      },
    });
    expect(lines[2]).toEqual({ role: "assistant", kind: "question", body: "A Polo shirt does not come with V neck.", lines: ["Change to Team jersey"] });
    expect(JSON.stringify(lines)).not.toMatch(/secret-token/);
  });

  it("keeps a question with its choices, and a reason with the ways on beneath it", () => {
    const asked = exchangeLines("change it", {
      type: "outcome",
      outcome: { kind: "question", question: "Which fit?", choices: [{ label: "Slim", token: "t" }, { label: "Relaxed", token: "t" }], recommended: 0 },
    });
    expect(asked[1]).toEqual({ role: "assistant", kind: "question", body: "Which fit?", lines: ["Slim", "Relaxed"] });
    const refused = exchangeLines("longer", {
      type: "outcome",
      outcome: { kind: "rejection", reason: "How much? Nothing was changed.", followUps: [{ text: "How much?", choices: [{ kind: "say", label: "+1 cm", text: "x" }] }] },
    });
    expect(refused).toEqual([
      { role: "person", kind: "text", body: "longer", lines: [] },
      { role: "assistant", kind: "rejection", body: "How much? Nothing was changed.", lines: ["+1 cm"] },
    ]);
    const many = exchangeLines("x", {
      type: "outcome",
      outcome: { kind: "rejection", reason: "None of that could be made.", followUps: [{ text: "One.", choices: [] }, { text: "Two.", choices: [] }] },
    });
    expect(many.map((line) => line.body)).toEqual(["x", "None of that could be made.", "One.", "Two."]);
  });

  it("keeps a failure, and nothing for progress", () => {
    expect(exchangeLines("x", { type: "failed", message: "Try again." })[1]).toEqual({ role: "assistant", kind: "failed", body: "Try again.", lines: [] });
    expect(exchangeLines("x", { type: "stage", stage: "model" })).toEqual([{ role: "person", kind: "text", body: "x", lines: [] }]);
  });

  it("keeps a choice as the person's words and what it changed", () => {
    expect(choiceLines("Change to Team jersey", ["Garment type changed."])).toEqual([
      { role: "person", kind: "text", body: "Change to Team jersey", lines: [] },
      { role: "assistant", kind: "applied", body: SAVED_TEXT, lines: ["Garment type changed."] },
    ]);
  });

  it("keeps every line within the limits the table holds", () => {
    const [line] = exchangeLines("x".repeat(5000), { type: "stage", stage: "model" });
    expect(line.body).toHaveLength(2000);
    const [, long] = choiceLines("y", Array.from({ length: 60 }, () => "z".repeat(900)));
    expect(long.lines).toHaveLength(40);
    expect(long.lines.every((text) => text.length <= 400)).toBe(true);
  });
});

/** A stand-in for the database client that records each call. */
function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "order", "limit", "insert"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: result.data ?? null, error: result.error ?? null });
  return { client: chain as unknown as SupabaseClient, calls };
}

describe("the conversation in the database", () => {
  const who = { brandId: "brand", projectId: "project" };

  it("reads the newest lines of the design, oldest first, for the brand", async () => {
    const { client, calls } = fakeClient({
      data: [
        { role: "assistant", kind: "applied", body: "Done.", lines: ["Fit changed."] },
        { role: "person", kind: "text", body: "slim fit", lines: [] },
      ],
    });
    expect(await loadChatHistory(client, who)).toEqual([
      { role: "person", kind: "text", body: "slim fit", lines: [] },
      { role: "assistant", kind: "applied", body: "Done.", lines: ["Fit changed."] },
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: "from", args: ["assistant_messages"] },
        { method: "eq", args: ["brand_id", "brand"] },
        { method: "eq", args: ["project_id", "project"] },
        { method: "order", args: ["id", { ascending: false }] },
        { method: "limit", args: [HISTORY_LIMIT] },
      ]),
    );
  });

  it("throws when the conversation cannot be read, so the page decides what to show", async () => {
    const { client } = fakeClient({ error: { message: "down" } });
    await expect(loadChatHistory(client, who)).rejects.toThrow(/could not be read/);
  });

  it("gives a page no conversation, and logs why, when it cannot be read", async () => {
    const logs: unknown[] = [];
    const { client } = fakeClient({ error: { message: "down" } });
    expect(await conversationFor(client, who, (event) => void logs.push(event))).toEqual([]);
    expect(logs).toHaveLength(1);
    const working = fakeClient({ data: [{ role: "person", kind: "text", body: "hi", lines: [] }] });
    expect(await conversationFor(working.client, who, () => undefined)).toHaveLength(1);
  });

  it("writes the lines in order, with the brand and design", async () => {
    const { client, calls } = fakeClient({});
    await recordLines(client, who, [{ role: "person", kind: "text", body: "hi", lines: [] }]);
    expect(calls).toContainEqual({
      method: "insert",
      args: [[{ brand_id: "brand", project_id: "project", role: "person", kind: "text", body: "hi", lines: [] }]],
    });
  });

  it("writes nothing for no lines, and throws when the write fails", async () => {
    const empty = fakeClient({});
    await recordLines(empty.client, who, []);
    expect(empty.calls).toEqual([]);
    const failing = fakeClient({ error: { message: "down" } });
    await expect(recordLines(failing.client, who, [{ role: "person", kind: "text", body: "hi", lines: [] }])).rejects.toThrow(/could not be kept/);
  });
});
