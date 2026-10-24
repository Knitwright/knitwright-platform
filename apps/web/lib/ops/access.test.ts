import { describe, expect, it } from "vitest";
import { assertPlatformAdmin } from "./access";

const client = (data: unknown, error: unknown = null) => ({ rpc: async () => ({ data, error }) }) as never;

describe("assertPlatformAdmin", () => {
  it("lets a platform admin through", async () => {
    await expect(assertPlatformAdmin(client(true))).resolves.toBeUndefined();
  });

  it.each([[false, null], [null, null], [true, { message: "x" }]])("answers not found otherwise (%s, %s)", async (data, error) => {
    await expect(assertPlatformAdmin(client(data, error))).rejects.toMatchObject({ code: "not_found" });
  });
});
