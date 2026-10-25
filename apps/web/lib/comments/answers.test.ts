import { describe, expect, it } from "vitest";
import { parseList, parseSaved, UNREADABLE } from "./answers";

const comment = { id: "a", parentId: null, version: 1, panelId: null, xMm: null, yMm: null, body: "Hi", authorId: "u", authorName: "Sam", createdAt: "2026-10-28T10:00:00Z", editedAt: null, deletedAt: null, resolvedAt: null, mentions: [] };
const data = { comments: [comment], members: [{ userId: "u", name: "Sam" }], viewer: { userId: "u", role: "viewer" } };

describe("parseList", () => {
  it("reads the comments, the members and who is looking", () => {
    expect(parseList({ success: true, data })).toEqual({ ok: true, ...data });
  });

  it("gives the server's own sentence for a refusal", () => {
    expect(parseList({ success: false, error: { code: "not_found", message: "That design does not exist." } })).toEqual({ ok: false, message: "That design does not exist." });
  });

  it.each([null, "text", { success: true }, { success: true, data: { ...data, comments: [{ ...comment, id: 5 }] } }, { success: true, data: { ...data, viewer: { userId: "u", role: "boss" } } }, { success: true, data: { ...data, members: [{ userId: "u" }] } }])(
    "does not trust an answer of the wrong shape (%#)",
    (body) => expect(parseList(body)).toEqual({ ok: false, message: UNREADABLE }),
  );
});

describe("parseSaved", () => {
  it("reads success, and a refusal's sentence", () => {
    expect(parseSaved({ success: true, data: { id: "a" } })).toEqual({ ok: true });
    expect(parseSaved({ success: false, error: { message: "Too many." } })).toEqual({ ok: false, message: "Too many." });
    expect(parseSaved(undefined)).toEqual({ ok: false, message: UNREADABLE });
  });
});
