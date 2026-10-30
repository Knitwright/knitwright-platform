import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { LIMITS } from "@/lib/server/limits";

/**
 * The production package's export route (plan v5 X5 item 6, decision 0070 revision 3). `defineRoute` is
 * replaced by one that hands back its own config, so the guard, the rate limit and the schema can be read and
 * the handler called with the context the framework would build. The work itself is `serveProductionPackage`,
 * which `lib/kpp/sources/**` tests; what is proved here is that the route asks it the right question and gives
 * its answer back unchanged — including the gate's refusal, which is the usual answer today.
 */

const state = vi.hoisted(() => ({ asked: [] as unknown[], answer: null as unknown }));

vi.mock("@/lib/server/define-route", () => ({ defineRoute: (config: unknown) => config }));
vi.mock("@/lib/kpp/sources/server", () => ({
  serveProductionPackage: async (who: unknown, projectId: string) => {
    state.asked.push({ who, projectId });
    if (state.answer instanceof Error) throw state.answer;
    return state.answer;
  },
}));

const PROJECT = "11111111-1111-4111-8111-111111111111";
const session = { userId: "u1", email: "o@example.com", brand: { id: "b1", name: "Acme FC", role: "owner" } };

type Route = { auth: string; rateLimit: unknown; schema: { params: { safeParse(value: unknown): { success: boolean } } }; handler(context: unknown): Promise<unknown> };

const route = async (): Promise<Route> => (await import("./route")).GET as unknown as Route;

beforeEach(() => {
  state.asked = [];
  state.answer = new Response("zip", { status: 200 });
});

describe("GET the production package of a design", () => {
  it("is for the brand's own members, held to the print-file limit, and takes one design id", async () => {
    const mounted = await route();

    expect(mounted.auth).toBe("member");
    // A package draws every panel and every pattern piece, so it is held like a set of print files, not like a read.
    expect(mounted.rateLimit).toBe(LIMITS.printFiles);
    expect(mounted.schema.params.safeParse({ projectId: PROJECT }).success).toBe(true);
    expect(mounted.schema.params.safeParse({ projectId: "not-a-design" }).success).toBe(false);
  });

  it("asks for the package of that design, for the signed-in member's own brand", async () => {
    await (await route()).handler({ session, input: { params: { projectId: PROJECT } } });

    expect(state.asked).toEqual([{ who: { brandId: "b1", brandName: "Acme FC", userId: "u1" }, projectId: PROJECT }]);
  });

  it("sends the ZIP back as it was made, with nothing added to it", async () => {
    const answer = (await (await route()).handler({ session, input: { params: { projectId: PROJECT } } })) as Response;

    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe("zip");
  });

  it("lets the gate's refusal reach the member in the gate's own words", async () => {
    state.answer = new AppError("conflict", "This production package cannot be built yet. BOM fabric: no quantity.");

    await expect((await route()).handler({ session, input: { params: { projectId: PROJECT } } })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("cannot be built yet"),
    });
  });
});
