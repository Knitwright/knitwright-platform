import { describe, expect, it } from "vitest";
import { specFor } from "./fixtures/fake-builder";
import { printFileBuilder } from "./builder";

describe("printFileBuilder", () => {
  it("says in plain words that print files cannot be made yet", async () => {
    await expect(printFileBuilder({ projectId: "p", roster: null }).build(specFor("front"))).rejects.toMatchObject({ code: "unavailable", message: expect.stringContaining("cannot be made yet") });
  });
});
