import { describe, expect, it } from "vitest";
import { WIRE_ACTION_TYPES } from "./reply-schema";
import { REPLY_TOOL_NAME, replyToolSchema } from "./reply-tool";

describe("the reply tool", () => {
  it("has a name the vendors accept and a schema for each kind of reply", () => {
    expect(REPLY_TOOL_NAME).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    const schema = replyToolSchema() as { type: string; properties: Record<string, unknown>; required: string[] };
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["kind"]);
    expect(Object.keys(schema.properties).sort()).toEqual(["actions", "choices", "kind", "question", "reason", "recommended"]);
  });

  it("describes every action the parser accepts, and carries no $schema key", () => {
    const text = JSON.stringify(replyToolSchema());
    for (const type of WIRE_ACTION_TYPES) expect(text).toContain(`"const":"${type}"`);
    expect(text).not.toContain("$schema");
  });
});
