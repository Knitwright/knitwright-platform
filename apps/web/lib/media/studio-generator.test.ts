import { describe, expect, it } from "vitest";
import { NO_DESIGN_MESSAGE, studioGenerator } from "./studio-generator";

const signal = new AbortController().signal;
const design = { projectId: "p", version: 1 };

describe("studioGenerator", () => {
  it("says so in words when the design cannot be drawn", async () => {
    expect(await studioGenerator(async () => null).generate({ design }, signal)).toEqual({ ok: false, message: NO_DESIGN_MESSAGE });
  });
});
