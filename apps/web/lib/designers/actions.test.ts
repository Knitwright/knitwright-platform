import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefineAction } from "@/lib/server/core/create-define-action";
import { makeDeps } from "@/lib/server/core/test-deps";

const create = vi.fn();

vi.mock("@/lib/server/define-action", async () => ({
  defineAction: createDefineAction(makeDeps({ brand: { id: "brand-1", name: "Club", role: "viewer" } as never }).deps),
}));
vi.mock("@/lib/server/deps", () => ({ adminClient: () => ({}), sessionClient: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ops/access", () => ({ assertPlatformAdmin: vi.fn() }));
vi.mock("./service", () => ({ createSubmission: (...a: unknown[]) => create(...a) }));

const input = { projectId: "11111111-1111-4111-8111-111111111111", title: "Hoops", sport: "football", style: "hoops", colourFamily: "blue" };

describe("newSubmissionAction", () => {
  beforeEach(() => create.mockReset());

  it("refuses a viewer before anything is read", async () => {
    const { newSubmissionAction } = await import("./actions");
    const result = await newSubmissionAction(input as never);
    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
