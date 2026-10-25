import { describe, expect, it } from "vitest";
import { readJson } from "./read-json";

describe("readJson", () => {
  it("returns the parsed body", async () => {
    expect(await readJson(new Response(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
  });

  it("returns null when the body is not JSON", async () => {
    expect(await readJson(new Response("<html>"))).toBeNull();
  });

  it("returns null for an empty body", async () => {
    expect(await readJson(new Response(""))).toBeNull();
  });
});
